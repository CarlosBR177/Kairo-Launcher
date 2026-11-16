package gg.kairo.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import gg.kairo.KairoClient;
import gg.kairo.module.HudModule;
import gg.kairo.module.Module;
import gg.kairo.module.ModuleManager;
import gg.kairo.util.Theme;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import net.fabricmc.loader.api.FabricLoader;

/**
 * Salva em config/kairo.json. O launcher lê e edita este mesmo arquivo,
 * então dá para ligar/desligar módulos, mudar opções e trocar a cor antes de abrir o jogo.
 *
 * <pre>
 * {
 *   "accent": "#8B5CFF",
 *   "modules": { "fps": { "enabled": true, "rx": 0.5, "ry": 0.0, "scale": 1.5 }, "crosshair": { "enabled": true, "style": "cross", ... } },
 *   "profiles": { "PvP": { "fps": true, "zoom": false } },
 *   "activeProfile": "PvP",
 *   "serverRules": [ { "server": "exemplo.com", "modules": ["freelook"] } ]
 * }
 * </pre>
 *
 * Chaves desconhecidas são preservadas, para o mod e o launcher não apagarem o que o outro escreveu.
 */
public final class KairoConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static JsonObject root = new JsonObject();

	private KairoConfig() {}

	private static Path file() {
		return FabricLoader.getInstance().getConfigDir().resolve("kairo.json");
	}

	public static void load() {
		Path path = file();
		if (!Files.exists(path)) {
			save();
			return;
		}
		try {
			JsonObject parsed = GSON.fromJson(Files.readString(path, StandardCharsets.UTF_8), JsonObject.class);
			if (parsed == null) return;
			root = parsed;
			if (root.has("accent")) Theme.setAccentHex(root.get("accent").getAsString());
			JsonObject modules = obj(root, "modules");
			for (Module m : ModuleManager.all()) {
				JsonObject o = modules.has(m.id) && modules.get(m.id).isJsonObject() ? modules.getAsJsonObject(m.id) : new JsonObject();
				if (o.has("enabled")) m.enabled = o.get("enabled").getAsBoolean();
				if (m instanceof HudModule h) {
					if (o.has("rx") && o.has("ry")) {
						h.rx = Opt.d(o, "rx", -1, 0, 1);
						h.ry = Opt.d(o, "ry", -1, 0, 1);
					} else {
						// formato antigo: pixels (convertido na primeira vez que aparece na tela)
						if (o.has("x")) h.x = o.get("x").getAsInt();
						if (o.has("y")) h.y = o.get("y").getAsInt();
					}
					h.setScale((float) Opt.d(o, "scale", 1, HudModule.MIN_SCALE, HudModule.MAX_SCALE));
				}
				m.readOptions(o);
			}
		} catch (IOException | RuntimeException e) {
			KairoClient.LOG.warn("Não consegui ler kairo.json, usando padrões", e);
		}
	}

	public static void save() {
		JsonObject out = root.deepCopy();
		out.addProperty("accent", Theme.accentHex());
		JsonObject modules = obj(out, "modules");
		for (Module m : ModuleManager.all()) {
			JsonObject o = modules.has(m.id) && modules.get(m.id).isJsonObject() ? modules.getAsJsonObject(m.id) : new JsonObject();
			o.addProperty("enabled", m.savedEnabled());
			if (m instanceof HudModule h) {
				o.remove("x");
				o.remove("y");
				if (h.rx >= 0 && h.ry >= 0) {
					o.addProperty("rx", Math.round(h.rx * 10000) / 10000.0);
					o.addProperty("ry", Math.round(h.ry * 10000) / 10000.0);
				} else {
					o.remove("rx");
					o.remove("ry");
				}
				o.addProperty("scale", h.scale);
			}
			m.writeOptions(o);
			modules.add(m.id, o);
		}
		out.add("modules", modules);
		root = out;
		try {
			Files.createDirectories(file().getParent());
			Path tmp = file().resolveSibling("kairo.json.tmp");
			Files.writeString(tmp, GSON.toJson(out), StandardCharsets.UTF_8);
			Files.move(tmp, file(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
		} catch (IOException e) {
			KairoClient.LOG.warn("Não consegui salvar kairo.json", e);
		}
	}

	private static JsonObject obj(JsonObject parent, String key) {
		return parent.has(key) && parent.get(key).isJsonObject() ? parent.getAsJsonObject(key) : new JsonObject();
	}

	// ---------- interface (tela inicial, ESC, tecla do editor) ----------
	// "ui": { "customTitle": true, "customPause": true, "hudKey": true, "titleScene": "anoitecer" }

	public static boolean ui(String key, boolean def) {
		JsonObject u = obj(root, "ui");
		try {
			return u.has(key) ? u.get(key).getAsBoolean() : def;
		} catch (RuntimeException e) {
			return def;
		}
	}

	public static String uiString(String key, String def) {
		JsonObject u = obj(root, "ui");
		try {
			return u.has(key) ? u.get(key).getAsString() : def;
		} catch (RuntimeException e) {
			return def;
		}
	}

	public static void setUi(String key, boolean value) {
		JsonObject u = obj(root, "ui");
		u.addProperty(key, value);
		root.add("ui", u);
		save();
	}

	public static void setUi(String key, String value) {
		JsonObject u = obj(root, "ui");
		u.addProperty(key, value);
		root.add("ui", u);
		save();
	}

	// ---------- perfis de HUD ----------

	public static List<String> profileNames() {
		List<String> names = new ArrayList<>();
		for (Map.Entry<String, JsonElement> e : obj(root, "profiles").entrySet()) names.add(e.getKey());
		return names;
	}

	public static String activeProfile() {
		return root.has("activeProfile") ? root.get("activeProfile").getAsString() : null;
	}

	/** Liga/desliga os módulos conforme o perfil. Posições e opções ficam como estão. */
	public static void applyProfile(String name) {
		JsonObject profiles = obj(root, "profiles");
		if (!profiles.has(name) || !profiles.get(name).isJsonObject()) return;
		JsonObject p = profiles.getAsJsonObject(name);
		for (Module m : ModuleManager.all()) {
			if (!p.has(m.id)) continue;
			boolean on = p.get(m.id).getAsBoolean();
			if (m.blocked) continue;
			m.setEnabled(on);
		}
		root.addProperty("activeProfile", name);
		save();
	}

	// ---------- regras por servidor ----------

	/** Módulos que devem ficar desligados no servidor informado (ip ou domínio). */
	public static List<String> blockedModulesFor(String address) {
		List<String> out = new ArrayList<>();
		if (address == null || !root.has("serverRules") || !root.get("serverRules").isJsonArray()) return out;
		String host = address.toLowerCase().trim();
		int colon = host.lastIndexOf(':');
		if (colon > 0 && host.indexOf(':') == colon) host = host.substring(0, colon);
		JsonArray rules = root.getAsJsonArray("serverRules");
		for (JsonElement el : rules) {
			if (!el.isJsonObject()) continue;
			JsonObject r = el.getAsJsonObject();
			String server = Opt.s(r, "server", "").toLowerCase().trim();
			if (server.isEmpty()) continue;
			if (host.equals(server) || host.endsWith("." + server)) {
				if (r.has("modules") && r.get("modules").isJsonArray()) {
					for (JsonElement id : r.getAsJsonArray("modules")) out.add(id.getAsString());
				}
			}
		}
		return out;
	}
}
