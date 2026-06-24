import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, SeparatorSpacingSize } from "discord.js";
import { db, guildSettings } from "../db.js";
import { eq } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("setlog").setDescription("Set the channel and user to ping for auto join checks")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(o => o.setName("channel").setDescription("Channel to send join check results to").setRequired(true))
  .addUserOption(o => o.setName("user").setDescription("User to ping when a spy is detected").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  if (!guildId) { await interaction.editReply("This only works inside a server."); return; }
  const channel = interaction.options.getChannel("channel", true);
  const user = interaction.options.getUser("user");
  const existing = await db.query.guildSettings.findFirst({ where: eq(guildSettings.guildId, guildId) });
  if (existing) await db.update(guildSettings).set({ logChannelId: channel.id, pingUserId: user?.id ?? existing.pingUserId }).where(eq(guildSettings.guildId, guildId));
  else await db.insert(guildSettings).values({ guildId, logChannelId: channel.id, pingUserId: user?.id ?? null });
  const c = new ContainerBuilder().setAccentColor(0x2ecc71)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("✅ **Log Setup Saved**"))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Log Channel**\n<#${channel.id}>${user ? `\n**Ping User**\n<@${user.id}>` : ""}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Every new member will now be auto-checked on join."));
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [c] });
}
