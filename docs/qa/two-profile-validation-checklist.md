# FieldsConnect Two-Profile Validation Checklist

## Purpose

Validate FieldsConnect as a two-sided mentorship network using two real test profiles.

This checklist confirms cross-user behavior across discovery, connections, messaging, timeline, skills, library documents, profile visibility, and notification requirements.

## Test Profiles

### User A

- Name:
- Email:
- Role type:
- Field:
- Mentor available:
- Avatar uploaded: Yes / No

### User B

- Name:
- Email:
- Role type:
- Field:
- Mentor available:
- Avatar uploaded: Yes / No

## 1. Signup, Login, Onboarding, and Profile Setup

| Test | Expected result | Pass/Fail | Notes |
|---|---|---|---|
| User A signs up and verifies email | Account can log in successfully |  |  |
| User B signs up and verifies email | Account can log in successfully |  |  |
| User A completes onboarding | User is redirected to timeline and no longer prompted to complete onboarding |  |  |
| User B completes onboarding | User is redirected to timeline and no longer prompted to complete onboarding |  |  |
| User A completes profile fields | Display name, role, field, bio, mentor status save correctly |  |  |
| User B completes profile fields | Display name, role, field, bio, mentor status save correctly |  |  |
| User A uploads avatar | Avatar displays on profile page |  |  |
| User B uploads avatar | Avatar displays on profile page |  |  |
| User A replaces avatar | New avatar displays and old avatar is deleted from Storage |  |  |
| User B deletes avatar | Avatar removed and Storage file deleted |  |  |

## 2. Finding People and Connection Requests

| Test | Expected result | Pass/Fail | Notes |
|---|---|---|---|
| User A opens Connections page | User B appears in Find people if profile is visible |  |  |
| User B opens Connections page | User A appears in Find people if profile is visible |  |  |
| User A sends request to User B | User B appears under outgoing requests for User A |  |  |
| User B sees incoming request from User A | Request appears under incoming requests |  |  |
| User B accepts User A request | Both users appear under accepted connections |  |  |
| Accepted connection no longer appears in Find people | Duplicate connection request is prevented |  |  |
| User A sends request to User B after declined request | Behavior is reviewed and documented |  |  |
| User disconnects from accepted connection | Not yet built; create feature ticket |  |  |

## 3. Messaging

| Test | Expected result | Pass/Fail | Notes |
|---|---|---|---|
| User A cannot message User B before accepted connection | No open inbox or unauthorized messaging path exists |  |  |
| User A can open message thread after acceptance | 1:1 conversation opens successfully |  |  |
| User A sends message to User B | Message appears in active conversation |  |  |
| User B sees message from User A | Message appears in same 1:1 conversation |  |  |
| User B replies to User A | Reply appears for both users |  |  |
| Message sender avatars display | Small avatar appears beside sender name/message |  |  |
| Messaging remains 1:1 only | No group messaging or open inbox behavior exists |  |  |

## 4. Timeline

| Test | Expected result | Pass/Fail | Notes |
|---|---|---|---|
| User A creates public post | User B can see the post |  |  |
| User B creates public post | User A can see the post |  |  |
| User A creates connections-only post | User B can see it only if connected |  |  |
| Non-connected user visibility is tested | Connections-only post should not be visible to non-connections |  |  |
| User B likes User A post | Like count updates |  |  |
| User B unlikes User A post | Like count decreases |  |  |
| User B comments on User A post | Comment appears under post |  |  |
| Timeline author avatars display | Avatar appears next to post author |  |  |
| Comment author avatars display | Smaller avatar appears next to commenter |  |  |
| Comment likes | Not yet built; create feature ticket if required |  |  |

## 5. Skills

| Test | Expected result | Pass/Fail | Notes |
|---|---|---|---|
| User A creates published skill | User A can see skill |  |  |
| User B creates published skill | User B can see skill |  |  |
| User A views User B published skills | Published skills should be accessible from profile view or skills surface |  |  |
| User A creates unpublished skill | Other users should not see unpublished skill |  |  |
| User B cannot edit/delete User A skills | Ownership enforcement works |  |  |
| Public profile skill display | Not yet built; create feature ticket |  |  |

## 6. Library Documents

| Test | Expected result | Pass/Fail | Notes |
|---|---|---|---|
| User A uploads public library document | User B can see/download it |  |  |
| User A uploads connections-only library document | User B can see/download it only after accepted connection |  |  |
| User A uploads private/unpublished document | User B cannot see/download it |  |  |
| User B cannot delete User A document | Ownership enforcement works |  |  |
| User A deletes own library document | File and database record are removed |  |  |
| Public profile document display | Not yet built; create feature ticket |  |  |

## 7. Cross-User Profile View

| Test | Expected result | Pass/Fail | Notes |
|---|---|---|---|
| User A can open User B profile from Connections | Not yet built; create public profile route |  |  |
| User A can open User B profile from Timeline | Not yet built; create public profile route |  |  |
| User A can open User B profile from Messages | Not yet built; create public profile route |  |  |
| Public profile shows avatar, name, role, field, bio | Not yet built |  |  |
| Public profile shows published skills | Not yet built |  |  |
| Public profile shows visible library documents | Not yet built |  |  |
| Profile visibility settings are respected | Public, connections-only, and private rules need validation |  |  |

## 8. Notifications Baseline Requirements

Notifications are not yet built. The following events should be included in the MVP notification baseline.

| Event | Recipient | Priority | Notes |
|---|---|---|---|
| Connection request received | Request recipient | High | Required |
| Connection request accepted | Original requester | High | Required |
| New message received | Message recipient | High | Required |
| Post liked | Post author | Medium | Required |
| Post commented on | Post author | Medium | Required |
| Comment liked | Comment author | Low | Only if comment likes are built |
| Skill published by connection | Accepted connections | Low | Later |
| Library document shared by connection | Accepted connections | Low | Later |

## 9. Notification System Acceptance Criteria

| Requirement | Expected result | Pass/Fail | Notes |
|---|---|---|---|
| Notification table exists | Stores recipient, actor, type, entity, read status, timestamps |  |  |
| Notification bell appears in navigation | User can see unread count |  |  |
| Notifications page or dropdown exists | User can review notifications |  |  |
| Mark notification as read | Read state updates |  |  |
| Mark all as read | All unread notifications clear |  |  |
| RLS protects notifications | Users can only view/update their own notifications |  |  |
| Duplicate notification spam is controlled | Repeated events do not create unreasonable duplicates |  |  |

## 10. Feature Gaps Identified

| Gap | Priority | Proposed PR |
|---|---|---|
| Public profile view route | High | `feat: add public profile view` |
| Disconnect/remove accepted connection | High | `feat: add disconnect connection action` |
| Notification system baseline | High | `feat: add notifications baseline` |
| Comment likes | Medium | `feat: add comment reactions` |
| Better cross-user skill browsing | Medium | `feat: expose published skills on public profiles` |
| Better cross-user library browsing | Medium | `feat: expose visible library docs on public profiles` |
| Brand/UI polish pass | Medium | `style: apply FieldsConnect visual identity polish` |

## QA Sign-Off

| Area | Status | Notes |
|---|---|---|
| Signup/onboarding/profile | Not started |  |
| Connections | Not started |  |
| Messaging | Not started |  |
| Timeline | Not started |  |
| Skills | Not started |  |
| Library | Not started |  |
| Public profile view | Not built |  |
| Notifications | Not built |  |
| Security/RLS | Not started |  |
