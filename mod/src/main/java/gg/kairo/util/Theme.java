package gg.kairo.util;

/** Cores do client. O destaque (accent) é configurável pelo launcher em config/kairo.json. */
public final class Theme {
	public static final int TEXT = 0xFFF2F3F7;
	public static final int MUTED = 0xFF9AA0B4;
	public static final int PANEL = 0x9A0A0C14;
	public static final int KEY_IDLE = 0x8C10131D;

	private static int accent = 0xFF8B5CFF;

	private Theme() {}

	public static int accent() {
		return accent;
	}

	/** Mesma cor com outro alfa (0–255). */
	public static int withAlpha(int argb, int alpha) {
		return (alpha & 0xFF) << 24 | (argb & 0x00FFFFFF);
	}

	public static void setAccentHex(String hex) {
		try {
			String clean = hex.startsWith("#") ? hex.substring(1) : hex;
			accent = 0xFF000000 | Integer.parseInt(clean, 16);
		} catch (RuntimeException ignored) {
			// mantém a cor atual se o valor for inválido
		}
	}

	public static String accentHex() {
		return String.format("#%06X", accent & 0xFFFFFF);
	}

	/** Mistura linear entre duas cores ARGB. */
	public static int mix(int a, int b, float t) {
		t = Math.max(0f, Math.min(1f, t));
		int aa = a >>> 24, ar = a >> 16 & 0xFF, ag = a >> 8 & 0xFF, ab = a & 0xFF;
		int ba = b >>> 24, br = b >> 16 & 0xFF, bg = b >> 8 & 0xFF, bb = b & 0xFF;
		return (int) (aa + (ba - aa) * t) << 24 | (int) (ar + (br - ar) * t) << 16
				| (int) (ag + (bg - ag) * t) << 8 | (int) (ab + (bb - ab) * t);
	}
}
