# Security Specification — Vento & Pistón Academy

## 1. Data Invariants
1. **Admin-Only Catalog & Quiz Mutations**: Only authenticated, email-verified admins (`supervisor1.atcvento@gmail.com` or members of `/admins/{uid}`) may create, update, or delete `/motorcycles`, `/specFields`, `/quizQuestions`, `/warrantyPolicies`, or `/timeGuides`.
2. **Active-Only Public Listing**: Non-admin clients may only read/list active (`isActive == true` or `isVisible == true`) catalog items, spec fields, quiz questions, warranty policies, and time-guide entries. Admins can read both active and deactivated/hidden items.
3. **Advisor Ownership & Score Bounds**: An advisor profile document `/advisors/{advisorId}` MUST have `advisorId == request.auth.uid`, `uid == request.auth.uid`, and non-negative numeric scores (`quizPoints >= 0`, `gameHighScore >= 0`, `totalPoints == quizPoints + gameHighScore` or `totalPoints >= 0`). No PII (`email`, `phone`, `address`) is stored in `/advisors`.
4. **Immutable Ownership & Timestamps**: `createdAt` is immutable on update and must equal `request.time` on create; `updatedAt` must equal `request.time` on create and update.
5. **Quiz Session Ownership**: `/quizSessions/{sessionId}` may only be created with `advisorUid == request.auth.uid` and read/listed by the owner or an admin.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. Unauthenticated `create` on `/motorcycles/hack1`
2. Non-admin verified user `create` on `/motorcycles/hack2`
3. Non-admin verified user `update` setting `isActive: false` on `/motorcycles/vento-rocketman-250`
4. Non-admin verified user `create` on `/warrantyPolicies/fake-policy`
5. Non-admin verified user `delete` on `/timeGuides/VC01`
6. Advisor A attempting to `create` `/advisors/advisorB_uid` with `uid: "advisorB_uid"` (Identity spoofing)
7. Advisor A attempting to `create` `/advisors/advisorA_uid` with extra ghost field `isAdmin: true` (Shadow field injection)
8. Advisor A attempting to `update` `/advisors/advisorA_uid` modifying `uid` or `createdAt` (Immortal field tamper)
9. Advisor A attempting to `create` `/advisors/advisorA_uid` with `quizPoints: -500` or `totalPoints: 99999999` (Negative/overflow poisoning)
10. Unverified email user (`email_verified: false`) attempting `create` on `/advisors/fake_uid`
11. Advisor A attempting to `list` `/quizSessions` belonging to Advisor B
12. Any user injecting a 2KB oversized string into `{motoId}` or `displayName` (Resource poisoning)
