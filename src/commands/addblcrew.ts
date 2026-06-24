import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, SeparatorSpacingSize,
} from "discord.js";
import { db, trackedGuilds, userTokens } from "../db.js";
import { eq } from "drizzle-orm";
import { isOwner } from "../constants.js";

const API = "https://discord.com/api/v10";
async function resolveGuildName(token: string, guildId: string): Promise<string | null> {
  try {
    const r = await fetch(`${API}/guilds/${guildId}`, { headers: { Authorization: token } });
    if (r.status === 200) return ((await r.json()) as { name: string }).name;
    return null;
  } catch { return null; }
}

export const data = new SlashCommandBuilder()
  .setName("addblcrew")
  .setDescription("Add or remove a rival crew server from the tracking list")
  .addSubcommand(s => s.setName("add").setDescription("Add a rival server to track")
    .addStringOption(o => o.setName("guild_id").setDescription("The server ID to track").setRequired(true))
    .addStringOption(o => o.setName("name").setDescription("Server name (auto-grabs if token is set)").setRequired(false)))
  .addSubcommand(s => s.setName("remove").setDescription("Remove a rival server from tracking")
    .addStringOption(o => o.setName("guild_id").setDescription("The server ID to remove").setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  if (!isOwner(interaction.user.id)) {
    const c = new ContainerBuilder().setAccentColor(0xe74c3c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("🚫 **You don't have permission to use this.**"));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.options.getString("guild_id", true).trim();

  if (sub === "add") {
    const existing = await db.query.trackedGuilds.findFirst({ where: eq(trackedGuilds.guildId, guildId) });
    if (existing) {
      const c = new ContainerBuilder().setAccentColor(0xe67e22)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ **Already tracking**\n> **${existing.guildName}** is already on the list.`));
      await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
    }
    let guildName = interaction.options.getString("name") ?? null;
    if (!guildName) { const t = await db.query.userTokens.findFirst(); if (t) guildName = await resolveGuildName(t.token, guildId); }
    if (!guildName) guildName = guildId;
    await db.insert(trackedGuilds).values({ guildId, guildName, addedBy: interaction.user.id });
    const c = new ContainerBuilder().setAccentColor(0x2ecc71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("✅ **Crew Added**"))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Server**\n${guildName}\n**ID**\n${guildId}`));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
  } else {
    const existing = await db.query.trackedGuilds.findFirst({ where: eq(trackedGuilds.guildId, guildId) });
    if (!existing) {
      const c = new ContainerBuilder().setAccentColor(0xe74c3c)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ **Not found**\n> \`${guildId}\` isn't being tracked.`));
      await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
    }
    await db.delete(trackedGuilds).where(eq(trackedGuilds.guildId, guildId));
    const c = new ContainerBuilder().setAccentColor(0xe74c3c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🗑️ **Crew Removed**\n> **${existing.guildName}** taken off the list.`));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
  }
}
