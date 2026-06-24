import { SlashCommandBuilder, ChatInputCommandInteraction, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, SeparatorSpacingSize } from "discord.js";
import { db, trackedGuilds, userTokens } from "../db.js";

const API = "https://discord.com/api/v10";
async function getGuildInfo(token: string, guildId: string): Promise<{ name: string; memberCount: number } | null> {
  try {
    const r = await fetch(`${API}/guilds/${guildId}?with_counts=true`, { headers: { Authorization: token } });
    if (r.status === 200) { const d = await r.json() as { name: string; approximate_member_count: number }; return { name: d.name, memberCount: d.approximate_member_count }; }
    return null;
  } catch { return null; }
}

export const data = new SlashCommandBuilder()
  .setName("showlist").setDescription("Show all tracked rival servers with member counts");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const all = await db.select().from(trackedGuilds);
  if (!all.length) {
    const c = new ContainerBuilder().setAccentColor(0xe67e22)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("🌐 **Server List**\nNothing tracked yet."));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }
  const token = await db.query.userTokens.findFirst();
  const rows: string[] = [];
  for (const t of all) {
    if (token) { const info = await getGuildInfo(token.token, t.guildId); if (info) { rows.push(`**${info.name}**\n> ID: \`${t.guildId}\` · Members: \`${info.memberCount.toLocaleString()}\``); continue; } }
    rows.push(`**${t.guildName}** *(unavailable)*\n> ID: \`${t.guildId}\``);
  }
  const c = new ContainerBuilder().setAccentColor(0x5865f2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("🌐 **Tracked Server List**"))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(rows.join("\n\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${all.length} server${all.length === 1 ? "" : "s"} total`));
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
}
