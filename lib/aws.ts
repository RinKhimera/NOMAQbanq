import "server-only"

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider"

import { env } from "@/lib/env/server"

/**
 * Couche AWS S3 bas-niveau (server-only) : client + presigned POST (upload
 * direct navigateur→S3) + suppression d'objet. La sécurité des chemins et les
 * helpers de domaine vivent dans `lib/storage.ts`. Auth via Vercel OIDC → rôle
 * IAM (aucun secret long-vécu en prod ; clés statiques = fallback dev local
 * géré par la chaîne de credentials par défaut du SDK).
 */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 Mo (aligne avec validateImageFile)

let client: S3Client | undefined

const getClient = (): S3Client => {
  if (!env.AWS_REGION || !env.AWS_ROLE_ARN) {
    throw new Error(
      "Configuration AWS manquante (AWS_REGION, AWS_ROLE_ARN, S3_BUCKET).",
    )
  }
  client ??= new S3Client({
    region: env.AWS_REGION,
    credentials: awsCredentialsProvider({
      roleArn: env.AWS_ROLE_ARN,
      audience: "sts.amazonaws.com",
    }),
  })
  return client
}

const getBucket = (): string => {
  if (!env.S3_BUCKET) {
    throw new Error("Configuration AWS manquante (S3_BUCKET).")
  }
  return env.S3_BUCKET
}

export type PresignedUpload = {
  url: string
  fields: Record<string, string>
}

/**
 * Presigned POST verrouillé : clé exacte (non falsifiable), taille [1, 5 Mo]
 * (content-length-range), Content-Type exact, expiration 60 s. C'est S3 qui
 * impose la taille — le fichier ne transite pas par notre serveur.
 */
export const createPresignedUpload = async (
  storagePath: string,
  contentType: string,
): Promise<PresignedUpload> => {
  const { url, fields } = await createPresignedPost(getClient(), {
    Bucket: getBucket(),
    Key: storagePath,
    Expires: 60,
    Conditions: [
      ["content-length-range", 1, MAX_UPLOAD_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
  })
  return { url, fields }
}

/** Supprime un objet S3 (idempotent : 204 même si absent). Best-effort. */
export const deleteFromS3 = async (storagePath: string): Promise<boolean> => {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: storagePath }),
    )
    return true
  } catch (error) {
    console.error("S3 delete error:", error)
    return false
  }
}
