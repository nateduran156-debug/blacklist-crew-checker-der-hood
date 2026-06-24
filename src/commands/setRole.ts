import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, SeparatorSpacingSize } from "discord.js";
import { db, guildSettings } from "../db.js";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("set-role").setDescription("Set which role is allowed to run /check")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption(o => o.setName("role").setDescription("Role that can use /check (leave empty to remove)").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  if (!guildId) { await interaction.editReply("This only works inside a server."); return; }
  const role = interaction.options.getRole("role");
  const existing = await db.query.guildSettings.findFirst({ where: eq(guildSettings.guildId, guildId) });
  if (role) {
    if (existing) await db.update(guildSettings).set({ checkRoleId: role.id }).where(eq(guildSettings.guildId, guildId));
    else await db.insert(guildSettings).values({ guildId, checkRoleId: role.id });
    const c = new ContainerBuilder().setAccentColor(0x2ecc71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("✅ **Role Set**"))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Only <@&${role.id}> can use \`/check\` now.`));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
  } else {
    if (existing) await db.update(guildSettings).set({ checkRoleId: null }).where(eq(guildSettings.guildId, guildId));
    const c = new ContainerBuilder().setAccentColor(0x95a5a6)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("✅ **Role restriction removed.**"));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
  }
}
