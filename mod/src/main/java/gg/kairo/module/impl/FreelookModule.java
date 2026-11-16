package gg.kairo.module.impl;

import gg.kairo.KairoClient;
import gg.kairo.module.Module;
import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.minecraft.util.Mth;

/**
 * Segure a tecla (padrão: Alt esquerdo) para girar a câmera em volta do personagem
 * sem mudar a direção em que ele anda. Mixins: EntityMixin e LocalPlayerMixin.
 */
public final class FreelookModule extends Module {
	public static boolean active;
	public static float yaw;
	public static float pitch;
	private static CameraType previous;

	public FreelookModule() {
		super("freelook", "Freelook", "Segure Alt para olhar ao redor sem virar o personagem.", true);
	}

	@Override
	public void tick(Minecraft mc) {
		boolean wants = enabled && mc.player != null && KairoClient.keyFreelook.isDown();
		if (wants && !active) {
			active = true;
			yaw = mc.player.getYRot();
			pitch = mc.player.getXRot();
			previous = mc.options.getCameraType();
			mc.options.setCameraType(CameraType.THIRD_PERSON_BACK);
		} else if (!wants && active) {
			active = false;
			if (previous != null) mc.options.setCameraType(previous);
		}
	}

	/** Mesma sensibilidade do vanilla (Entity#turn multiplica por 0.15). */
	public static void turn(double dYaw, double dPitch) {
		yaw += (float) dYaw * 0.15f;
		pitch = Mth.clamp(pitch + (float) dPitch * 0.15f, -90f, 90f);
	}
}
