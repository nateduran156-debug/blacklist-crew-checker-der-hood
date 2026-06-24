import {
  SlashCommandBuilder, ChatInputCommandInteraction, GuildMember,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder,
  ThumbnailBuilder, MessageFlags, SeparatorSpacingSize,
} from "discord.js";
import { db, trackedGuilds, guildSettings, userTokens } from "../db.js";
import { eq } from "drizzle-orm";

const API = "https://discord.com/api/v10";
async function isMember(token: string, guildId: string, userId: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${API}/guilds/${guildId}/members/${userId}`, { headers: { Authorization: token } });
    if (r.status === 200) return true;
    if (r.status === 404) return false;
    return null;
  } catch { return null; }
}

export const data = new SlashCommandBuilder()
  .setName("check")
  .setDescription("Check if a user is in any blacklisted crew servers before letting them in")
  .addUserOption(o => o.setName("user").setDescription("The user you wanna run").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const guildId = interaction.guildId;
  if (!guildId) { await interaction.editReply("This only works inside a server."); return; }

  const settings = await db.query.guildSettings.findFirst({ where: eq(guildSettings.guildId, guildId) });

  if (!settings?.checkRoleId) {
    const c = new ContainerBuilder().setAccentColor(0xe74c3c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("🚫 **No role set up yet.**\nAn admin needs to run `/set-role` before anyone can use `/check`."));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }

  const member = interaction.member as GuildMember;
  if (!member.roles.cache.has(settings.checkRoleId)) {
    const c = new ContainerBuilder().setAccentColor(0xe74c3c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("🚫 **You don't have the required role to use this.**"));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }

  const allTokens = await db.select().from(userTokens);
  if (!allTokens.length) {
    const c = new ContainerBuilder().setAccentColor(0xe67e22)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("⚠️ **No user token set up yet.**\nRun `/adduser` first."));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }

  const activeToken = allTokens[allTokens.length - 1];
  const allTracked = await db.select().from(trackedGuilds);
  if (!allTracked.length) {
    const c = new ContainerBuilder().setAccentColor(0xe67e22)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("⚠️ **No rival servers added yet.**\nUse `/addblcrew add` to start."));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const found: string[] = [];
  for (const t of allTracked) {
    const r = await isMember(activeToken.token, t.guildId, targetUser.id);
    if (r === true) found.push(t.guildName);
  }

  const isSpy = found.length > 0;
  const now = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

  const header = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${isSpy ? "🚨" : "🔎"} **Server Check — ${targetUser.username}**`))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ size: 64 })));

  const container = new ContainerBuilder()
    .setAccentColor(isSpy ? 0xe74c3c : 0x2ecc71)
    .addSectionComponents(header)
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    isSpy ? `🚨 **In these blacklisted crews (${found.length})**\n${found.map(n => `• ${n}`).join("\n")}` : "Free to be verified 👍"
  ));

  container
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# /getruin • Token: ${activeToken.label} • Today at ${now}`));

  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
}
