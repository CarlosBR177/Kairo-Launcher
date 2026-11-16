package gg.kairo.combat;

import gg.kairo.module.ModuleManager;
import gg.kairo.module.impl.ComboModule;
import gg.kairo.module.impl.ParticlesModule;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.minecraft.client.Minecraft;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;

/**
 * Um único ponto para os eventos de combate do jogador local.
 * Só lê o que aconteceu: nunca muda o ataque, o alcance ou o que vai para o servidor.
 */
public final class CombatEvents {
	private CombatEvents() {}

	public static void register() {
		AttackEntityCallback.EVENT.register((player, level, hand, entity, hit) -> {
			// no singleplayer o servidor interno também dispara o evento, com outro objeto de jogador
			if (player == Minecraft.getInstance().player) onAttack(entity);
			return InteractionResult.PASS;
		});
	}

	private static void onAttack(Entity target) {
		Minecraft mc = Minecraft.getInstance();
		if (ModuleManager.get("combo") instanceof ComboModule combo) combo.onAttack(mc, target);
		if (ModuleManager.get("particles") instanceof ParticlesModule particles) particles.onAttack(mc, target);
	}
}
