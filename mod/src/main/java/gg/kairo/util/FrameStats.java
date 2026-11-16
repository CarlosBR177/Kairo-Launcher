package gg.kairo.util;

import gg.kairo.compat.Compat;
import java.util.ArrayDeque;
import java.util.Deque;
import net.minecraft.client.Minecraft;

/**
 * Contadores atualizados a cada frame: FPS (medido por nós, sem depender da API interna)
 * e CPS (cliques por segundo) dos botões esquerdo e direito.
 */
public final class FrameStats {
	private static int frames;
	private static int fps;
	private static long windowStart;

	private static final Deque<Long> LEFT = new ArrayDeque<>();
	private static final Deque<Long> RIGHT = new ArrayDeque<>();
	private static boolean leftWasDown;
	private static boolean rightWasDown;

	private FrameStats() {}

	public static void frame(Minecraft mc) {
		long now = Compat.millis();

		frames++;
		if (now - windowStart >= 1000) {
			fps = frames;
			frames = 0;
			windowStart = now;
		}

		boolean left = mc.options.keyAttack.isDown();
		boolean right = mc.options.keyUse.isDown();
		if (left && !leftWasDown) LEFT.addLast(now);
		if (right && !rightWasDown) RIGHT.addLast(now);
		leftWasDown = left;
		rightWasDown = right;
		prune(LEFT, now);
		prune(RIGHT, now);
	}

	private static void prune(Deque<Long> clicks, long now) {
		while (!clicks.isEmpty() && now - clicks.peekFirst() > 1000) clicks.removeFirst();
	}

	public static int fps() {
		return fps;
	}

	public static int leftCps() {
		return LEFT.size();
	}

	public static int rightCps() {
		return RIGHT.size();
	}
}
