import { SlashCommandBuilder, ChatInputCommandInteraction, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, SeparatorSpacingSize } from "discord.js";
import { db, trackedGuilds } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("bl").setDescription("BL crew commands")
  .addSubcommand(s => s.setName("crews").setDescription("List all rival crews we're tracking"));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const all = await db.select().from(trackedGuilds);
  if (!all.length) {
    const c = new ContainerBuilder().setAccentColor(0xe67e22)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("📋 **BL Crew List**\nNo rival servers added yet."));
    await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] }); return;
  }
  const c = new ContainerBuilder().setAccentColor(0x5865f2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("📋 **BL Crew List**"))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(all.map((g, i) => `**${i + 1}.** ${g.guildName} — \`${g.guildId}\``).join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${all.length} rival server${all.length === 1 ? "" : "s"} tracked`));
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
}
