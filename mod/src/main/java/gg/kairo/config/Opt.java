package gg.kairo.config;

import com.google.gson.JsonObject;

/** Leitura tolerante das opções dos módulos (valor ausente ou inválido → padrão). */
public final class Opt {
	private Opt() {}

	public static int i(JsonObject o, String key, int def, int min, int max) {
		try {
			return o.has(key) ? Math.max(min, Math.min(max, o.get(key).getAsInt())) : def;
		} catch (RuntimeException e) {
			return def;
		}
	}

	public static double d(JsonObject o, String key, double def, double min, double max) {
		try {
			return o.has(key) ? Math.max(min, Math.min(max, o.get(key).getAsDouble())) : def;
		} catch (RuntimeException e) {
			return def;
		}
	}

	public static boolean b(JsonObject o, String key, boolean def) {
		try {
			return o.has(key) ? o.get(key).getAsBoolean() : def;
		} catch (RuntimeException e) {
			return def;
		}
	}

	public static String s(JsonObject o, String key, String def) {
		try {
			return o.has(key) ? o.get(key).getAsString() : def;
		} catch (RuntimeException e) {
			return def;
		}
	}

	/** "accent" ou "#RRGGBB" → ARGB opaco. */
	public static int color(String value, int accent) {
		if (value == null || value.isBlank() || value.equalsIgnoreCase("accent")) return accent;
		try {
			String clean = value.startsWith("#") ? value.substring(1) : value;
			return 0xFF000000 | Integer.parseInt(clean, 16);
		} catch (RuntimeException e) {
			return accent;
		}
	}
}
