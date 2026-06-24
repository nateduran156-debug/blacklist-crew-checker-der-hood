import {
  SlashCommandBuilder, ChatInputCommandInteraction,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, SeparatorSpacingSize,
} from "discord.js";
import { db, userTokens } from "../db.js";
import { eq } from "drizzle-orm";
import { isOwner } from "../constants.js";

const API = "https://discord.com/api/v10";
async function validateToken(token: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const r = await fetch(`${API}/users/@me`, { headers: { Authorization: token } });
    if (r.status === 200) return { valid: true, username: ((await r.json()) as { username: string }).username };
    return { valid: false };
  } catch { return { valid: false }; }
}

export const data = new SlashCommandBuilder()
  .setName("adduser")
  .setDescription("Add a Discord user token for checking server membership")
  .addStringOption(o => o.setName("token").setDescription("The Discord user token").setRequired(true))
  .addStringOption(o => o.setName("label").setDescription("Nickname for this token").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  if (!isOwner(interaction.user.id)) {
    const c = new ContainerBuilder().setAccentColor(0xe74c3c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("🚫 **You don't have permission to use this.**"));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }
  const token = interaction.options.getString("token", true).trim();
  const { valid, username } = await validateToken(token);
  if (!valid) {
    const c = new ContainerBuilder().setAccentColor(0xe74c3c)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("❌ **Invalid token**\nThat token didn't work."));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }
  const label = interaction.options.getString("label") ?? username ?? "unknown";
  const existing = await db.query.userTokens.findFirst({ where: eq(userTokens.token, token) });
  if (existing) {
    const c = new ContainerBuilder().setAccentColor(0xe67e22)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ **Already added** as **${existing.label}**.`));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }
  await db.insert(userTokens).values({ label, token, addedBy: interaction.user.id });
  const c = new ContainerBuilder().setAccentColor(0x2ecc71)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("✅ **User Token Added**"))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Account**\n${username ?? "Unknown"}\n**Label**\n${label}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# This token will be used for all /check lookups."));
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
}
