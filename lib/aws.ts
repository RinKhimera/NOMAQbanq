import "server-only"

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider"

import { env } from "@/lib/env/server"

/**
 * Couche AWS S3 bas-niveau (server-only) : client + presigned POST (upload
 * direct navigateur→S3) + suppression d'objet. La sécurité des chemins et les
 * helpers de domaine vivent dans `lib/storage.ts`. Auth via Vercel OIDC → rôle
 * IAM (aucun secret long-vécu en prod ; clés statiques explicites = fallback
 * dev local, cf. `resolveCredentials`).
 */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 Mo (aligne avec validateImageFile)

let client: S3Client | undefined

// Clés statiques explicites (user IAM dédié, dev local) prioritaires ; sinon
// OIDC → rôle IAM (prod/preview Vercel, aucun secret long-vécu).
const resolveCredentials = () => {
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    }
  }
  if (env.AWS_ROLE_ARN) {
    return awsCredentialsProvider({
      roleArn: env.AWS_ROLE_ARN,
      audience: "sts.amazonaws.com",
    })
  }
  throw new Error(
    "Configuration AWS manquante (AWS_ROLE_ARN pour OIDC, ou AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY pour le dev local).",
  )
}

const getClient = (): S3Client => {
  if (!env.AWS_REGION) {
    throw new Error("Configuration AWS manquante (AWS_REGION).")
  }
  client ??= new S3Client({
    region: env.AWS_REGION,
    credentials: resolveCredentials(),
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

/**
 * Copie un objet dans le même bucket (`tmp/…` → `questions/…` au save d'une
 * question). Contrairement à `deleteFromS3`, lève en cas d'échec : on ne doit
 * jamais persister un chemin final dont l'objet n'existe pas. Les clés sont
 * dérivées serveur (URL-safe) ; l'appelant valide via `assertSafeStoragePath`.
 */
export const copyInS3 = async (
  fromKey: string,
  toKey: string,
): Promise<void> => {
  await getClient().send(
    new CopyObjectCommand({
      Bucket: getBucket(),
      CopySource: `${getBucket()}/${fromKey}`,
      Key: toKey,
    }),
  )
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
