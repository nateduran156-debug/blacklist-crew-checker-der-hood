import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  PermissionFlagsBits,
} from "discord.js";
import { db, trackedGuilds, userTokens } from "../db.js";

const API = "https://discord.com/api/v10";

async function isMember(token: string, guildId: string, userId: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${API}/guilds/${guildId}/members/${userId}`, { headers: { Authorization: token } });
    if (r.status === 200) return true;
    if (r.status === 404) return false;
    if (r.status === 429) {
      const retry = Number(r.headers.get("Retry-After") ?? 1);
      await new Promise((res) => setTimeout(res, retry * 1000));
      return isMember(token, guildId, userId);
    }
    return null;
  } catch { return null; }
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const data = new SlashCommandBuilder()
  .setName("checkall")
  .setDescription("Scan every member in this server against all blacklisted crew servers")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) { await interaction.editReply("This only works inside a server."); return; }

  const allTokens = await db.select().from(userTokens);
  if (!allTokens.length) {
    const c = new ContainerBuilder().setAccentColor(0xe67e22)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("⚠️ **No user token set up yet.**\nRun `/adduser` first."));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }

  const allTracked = await db.select().from(trackedGuilds);
  if (!allTracked.length) {
    const c = new ContainerBuilder().setAccentColor(0xe67e22)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("⚠️ **No rival servers added yet.**\nUse `/addblcrew add` to start."));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }

  const activeToken = allTokens[allTokens.length - 1];
  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [new ContainerBuilder().setAccentColor(0x5865f2)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("🔍 **Scanning all members...**\nThis may take a while for large servers."))],
  });

  let memberList: Array<{ id: string; username: string; bot: boolean }> = [];
  try {
    const members = await guild.members.fetch();
    for (const [, m] of members) memberList.push({ id: m.id, username: m.user.username, bot: m.user.bot });
  } catch {
    try {
      const botToken = process.env["DISCORD_TOKEN"]!;
      let lastId: string | null = null;
      let batch: typeof memberList = [];
      do {
        const url = `${API}/guilds/${guild.id}/members?limit=1000${lastId ? `&after=${lastId}` : ""}`;
        const res = await fetch(url, { headers: { Authorization: `Bot ${botToken}` } });
        if (!res.ok) break;
        const raw = await res.json() as Array<{ user: { id: string; username: string; bot?: boolean } }>;
        if (!raw.length) break;
        batch = raw.map((m) => ({ id: m.user.id, username: m.user.username, bot: m.user.bot ?? false }));
        memberList.push(...batch);
        lastId = batch[batch.length - 1]?.id ?? null;
        await sleep(500);
      } while (batch.length === 1000);
    } catch {
      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [new ContainerBuilder().setAccentColor(0xe74c3c)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            "❌ **Could not fetch members.**\n\nMake sure **Server Members Intent** is enabled in the Discord Developer Portal under your bot's settings."
          ))],
      }); return;
    }
  }

  const realMembers = memberList.filter((m) => !m.bot);
  const spies: Array<{ username: string; userId: string; crews: string[] }> = [];
  for (const member of realMembers) {
    const found: string[] = [];
    for (const t of allTracked) {
      const result = await isMember(activeToken.token, t.guildId, member.id);
      if (result === true) found.push(t.guildName);
    }
    if (found.length > 0) spies.push({ username: member.username, userId: member.id, crews: found });
    await sleep(100);
  }

  const now = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

  if (spies.length === 0) {
    const c = new ContainerBuilder().setAccentColor(0x2ecc71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("✅ **All Clear!**"))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `Scanned **${realMembers.length}** members against **${allTracked.length}** rival server${allTracked.length === 1 ? "" : "s"}.\n\nNo spies found.`
      ))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# /getruin • Token: ${activeToken.label} • Today at ${now}`));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }

  const spyLines = spies.map((s) => `🚨 **${s.username}** (<@${s.userId}>)\n${s.crews.map((c) => `　• ${c}`).join("\n")}`);
  const textChunks: string[] = [];
  let current = "";
  for (const line of spyLines) {
    const attempt = current ? current + "\n\n" + line : line;
    if (attempt.length > 1800) { if (current) textChunks.push(current); current = line; }
    else { current = attempt; }
  }
  if (current) textChunks.push(current);

  const footer = `-# /getruin • Token: ${activeToken.label} • Today at ${now} • Checked ${allTracked.length} rival server${allTracked.length === 1 ? "" : "s"}`;

  const firstContainer = new ContainerBuilder().setAccentColor(0xe74c3c)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🚨 **Spies Found — ${spies.length} of ${realMembers.length} members**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(textChunks[0] ?? ""));
  if (textChunks.length === 1) {
    firstContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));
  }
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [firstContainer] });

  for (let i = 1; i < textChunks.length; i++) {
    const isLast = i === textChunks.length - 1;
    const chunk = new ContainerBuilder().setAccentColor(0xe74c3c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(textChunks[i]));
    if (isLast) chunk.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));
    await interaction.followUp({ flags: MessageFlags.IsComponentsV2, components: [chunk] });
  }
}
