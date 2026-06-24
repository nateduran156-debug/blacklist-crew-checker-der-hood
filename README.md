# Checker Bot

Anti-spy crew checker. Auto-checks members on join and DMs owner every time.

## Setup
1. Copy `.env.example` to `.env` and fill in your values
2. `npm install`
3. `psql $DATABASE_URL < schema.sql`
4. `npm run dev`

## Permissions
- `/addblcrew`, `/adduser` — hardcoded owner only (OWNER_IDS in constants.ts)
- `/check` — requires role set with `/set-role`
- All other commands — admin only

## Commands
- `/check @user` — check if in any blacklisted crew
- `/addblcrew add/remove <id>` — manage tracked crews (owner only)
- `/adduser <token>` — add user token (owner only)
- `/bl crews` — list tracked crews
- `/set-role <role>` — set role required for /check
- `/showlist` — show servers with member counts
- `/setlog #channel @user` — set log channel + DM user
