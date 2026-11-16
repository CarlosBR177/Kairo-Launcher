package gg.kairo.module.impl;

import com.google.gson.JsonObject;
import gg.kairo.config.Opt;
import gg.kairo.module.Module;
import net.minecraft.client.Minecraft;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;

/** Mais partículas de crítico/afiação ao bater. Puramente visual, só no seu cliente. */
public final class ParticlesModule extends Module {
	private int multiplier = 2;
	private boolean alwaysCrit = false;
	private boolean alwaysSharpness = false;

	public ParticlesModule() {
		super("particles", "Partículas de hit", "Multiplica as partículas de crítico e afiação ao acertar.", false);
	}

	public void onAttack(Minecraft mc, Entity target) {
		if (!enabled || !(target instanceof LivingEntity) || mc.player == null) return;
		boolean crit = alwaysCrit || (mc.player.fallDistance > 0 && !mc.player.onGround() && !mc.player.isInWater());
		for (int i = 0; i < multiplier; i++) {
			if (crit) mc.particleEngine.createTrackingEmitter(target, ParticleTypes.CRIT);
			if (alwaysSharpness) mc.particleEngine.createTrackingEmitter(target, ParticleTypes.ENCHANTED_HIT);
		}
	}

	@Override
	public void readOptions(JsonObject o) {
		multiplier = Opt.i(o, "multiplier", multiplier, 1, 10);
		alwaysCrit = Opt.b(o, "alwaysCrit", alwaysCrit);
		alwaysSharpness = Opt.b(o, "alwaysSharpness", alwaysSharpness);
	}

	@Override
	public void writeOptions(JsonObject o) {
		o.addProperty("multiplier", multiplier);
		o.addProperty("alwaysCrit", alwaysCrit);
		o.addProperty("alwaysSharpness", alwaysSharpness);
	}
}
