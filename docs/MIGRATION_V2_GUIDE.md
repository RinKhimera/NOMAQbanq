# Migration Guide: V1 → V2 Exam Participations

## Overview

This guide documents the migration from embedded `participants` array in `exams` table to normalized `examParticipations` and `examAnswers` tables.

## Why This Migration?

### Problem with V1 (Embedded)

- Each exam document can grow to 500KB-1MB with all participants + answers
- Every read of an exam loads ALL participant data (bandwidth cost)
- Updating one participant requires read-modify-write of entire array
- No efficient querying by user or status

### Benefits of V2 (Normalized)

- Efficient indexed lookups by exam, user, or both
- Only load data you need
- Atomic updates per participant
- Scalable to unlimited participants

## Architecture

### V1 Schema (Legacy)

```typescript
exams: {
  // ...exam fields
  participants: [
    {
      userId: Id<"users">,
      score: number,
      answers: [{ questionId, selectedAnswer, isCorrect }],
      // ...pause fields
    },
  ]
}
```

### V2 Schema (New)

```typescript
examParticipations: {
  examId: Id<"exams">,
  userId: Id<"users">,
  score: number,
  // ...all fields except answers
}

examAnswers: {
  participationId: Id<"examParticipations">,
  questionId: Id<"questions">,
  selectedAnswer: string,
  isCorrect: boolean
}
```

## Migration Strategy: Zero-Downtime Hybrid

The migration uses a **hybrid read/write pattern** during transition:

1. V1 functions remain working (no breaking changes)
2. V2 functions work with new normalized tables
3. Frontend can be migrated incrementally

## Pre-Migration Checklist

- [ ] Take a Convex backup in Dashboard (Settings > Backups > Backup Now)
- [ ] Or use CLI: `npx convex export --prod --path ./backups`
- [ ] Test migration in dev deployment first
- [ ] Review current data volume: `npx convex run migrations:checkMigrationStatus`

## Step-by-Step Production Migration

### Step 1: Deploy Schema (No Frontend Changes)

```bash
# Deploy only backend changes (schema + V2 functions)
npx convex deploy
```

This adds the new tables without affecting existing functionality.

### Step 2: Check Migration Status

```bash
npx convex run --prod migrations:checkMigrationStatus
```

Expected output:

```json
{
  "v1": {
    "examsWithParticipants": 15,
    "totalParticipants": 234,
    "totalAnswers": 46800
  },
  "v2": {
    "participations": 0,
    "answers": 0
  },
  "migrationComplete": false
}
```

### Step 3: Export V1 Data (Safety Backup)

```bash
npx convex run --prod migrations:exportV1ParticipantData > v1_backup.json
```

### Step 4: Run Migration in Batches

```bash
# Start with small batch to test
npx convex run --prod migrations:migrateExamParticipants '{"batchSize": 1}'

# If successful, increase batch size
npx convex run --prod migrations:migrateExamParticipants '{"batchSize": 5}'

# Repeat until complete
npx convex run --prod migrations:migrateExamParticipants '{"batchSize": 10}'
```

**Important:** Run in small batches to avoid timeouts. Each batch processes `batchSize` exams.

### Step 5: Verify Migration Integrity

```bash
npx convex run --prod migrations:verifyMigrationIntegrity
```

Expected output:

```json
{
  "isValid": true,
  "issues": [],
  "summary": {
    "v1Participants": 234,
    "v2Participants": 234,
    "v1Answers": 46800,
    "v2Answers": 46800,
    "missingParticipations": 0,
    "missingAnswers": 0
  }
}
```

### Step 6: Deploy Frontend with V2 APIs

Update frontend to use V2 functions:

- `api.exams.startExam` → `api.exams.startExamV2`
- `api.exams.submitExamAnswers` → `api.exams.submitExamAnswersV2`
- `api.exams.getExamSession` → `api.exams.getExamSessionV2`
- etc.

```bash
# Deploy frontend changes
npm run build
npx convex deploy
```

### Step 7: Monitoring Period (1-2 Weeks)

Monitor the application:

- Check error logs
- Verify exam functionality works
- Keep V1 data intact as fallback

### Step 8: Cleanup (Optional)

After confirming everything works, remove embedded participant data:

```bash
npx convex run --prod migrations:migrateExamParticipants '{"clearAfterMigration": true, "batchSize": 5}'
```

## Rollback Procedure

If issues occur:

### Option 1: Restore from Backup (Full Rollback)

```bash
# Restore full backup (destructive - replaces ALL data)
npx convex import --prod --replace backup.zip
```

### Option 2: Redeploy Old Code (Keep Data)

```bash
# Checkout previous version
git checkout <previous-commit>

# Redeploy
npx convex deploy
```

### Option 3: Switch Frontend Back to V1 APIs

Since V1 functions still exist, simply revert frontend imports.

## Troubleshooting

### Migration Times Out

- Reduce `batchSize` to 1-3
- Run during off-peak hours

### Missing Data After Migration

- Run `verifyMigrationIntegrity`
- Check `issues` array for specific problems
- Re-run migration for affected exams

### V2 Queries Return Empty

- Ensure schema was deployed: `npx convex deploy`
- Check indexes exist in Convex Dashboard
- Verify migration completed: `checkMigrationStatus`

## API Reference

### Migration Functions

| Function                   | Description                  |
| -------------------------- | ---------------------------- |
| `checkMigrationStatus`     | Shows V1 vs V2 record counts |
| `migrateExamParticipants`  | Migrates data in batches     |
| `verifyMigrationIntegrity` | Compares V1 and V2 data      |
| `exportV1ParticipantData`  | Exports V1 data to JSON      |

### V2 Exam Functions

| V1 Function                 | V2 Function                   |
| --------------------------- | ----------------------------- |
| `startExam`                 | `startExamV2`                 |
| `submitExamAnswers`         | `submitExamAnswersV2`         |
| `getExamSession`            | `getExamSessionV2`            |
| `getParticipantExamResults` | `getParticipantExamResultsV2` |
| `startPause`                | `startPauseV2`                |
| `resumeFromPause`           | `resumeFromPauseV2`           |
| `getPauseStatus`            | `getPauseStatusV2`            |
| `validateQuestionAccess`    | `validateQuestionAccessV2`    |
| `getExamLeaderboard`        | `getExamLeaderboardV2`        |
| `getAllExamsMetadata`       | `getAllExamsMetadataV2`       |
| `getMyDashboardStats`       | `getMyDashboardStatsV2`       |
| `getMyRecentExams`          | `getMyRecentExamsV2`          |

## Timeline Recommendation

| Phase           | Duration  | Actions                   |
| --------------- | --------- | ------------------------- |
| Preparation     | 1 day     | Backup, test in dev       |
| Migration       | 1-2 hours | Run batched migration     |
| Verification    | 1 day     | Monitor, verify integrity |
| Frontend Deploy | 1 day     | Deploy V2 API usage       |
| Monitoring      | 1-2 weeks | Watch for issues          |
| Cleanup         | 1 day     | Clear V1 embedded data    |

## Support

If you encounter issues:

1. Check Convex Dashboard logs
2. Review this guide's troubleshooting section
3. Reach out to Convex Discord community
