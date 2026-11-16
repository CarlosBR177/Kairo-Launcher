package gg.kairo.module.impl;

import gg.kairo.compat.Gfx;
import com.google.gson.JsonObject;
import gg.kairo.config.Opt;
import gg.kairo.module.HudModule;
import gg.kairo.util.Render2D;
import gg.kairo.util.Theme;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

/** Quantos itens de PvP você ainda tem: pérolas, maçãs, poções, flechas, totens… */
public final class ItemCounterModule extends HudModule {
	private static final int ROW = 17;
	private static final Item[] TRACKED = {
			Items.ENDER_PEARL, Items.GOLDEN_APPLE, Items.ENCHANTED_GOLDEN_APPLE, Items.SPLASH_POTION,
			Items.POTION, Items.ARROW, Items.TOTEM_OF_UNDYING, Items.COBWEB, Items.WIND_CHARGE
	};

	private boolean hideZero = true;

	public ItemCounterModule() {
		super("items", "Contador de itens", "Pérolas, maçãs douradas, poções, flechas e totens no inventário.", false, 4, 310);
		defaultAnchor(1.0, 0.45);
	}

	private record Entry(ItemStack icon, int count) {}

	private List<Entry> entries(Minecraft mc) {
		List<Entry> out = new ArrayList<>();
		if (mc.player == null) {
			out.add(new Entry(new ItemStack(Items.ENDER_PEARL), 16));
			out.add(new Entry(new ItemStack(Items.GOLDEN_APPLE), 12));
			out.add(new Entry(new ItemStack(Items.SPLASH_POTION), 7));
			return out;
		}
		Inventory inv = mc.player.getInventory();
		for (Item item : TRACKED) {
			int count = 0;
			for (int i = 0; i < inv.getContainerSize(); i++) {
				ItemStack s = inv.getItem(i);
				if (s.is(item)) count += s.getCount();
			}
			if (count > 0 || !hideZero) out.add(new Entry(new ItemStack(item), count));
		}
		if (out.isEmpty() && editing) {
			out.add(new Entry(new ItemStack(Items.ENDER_PEARL), 16));
			out.add(new Entry(new ItemStack(Items.GOLDEN_APPLE), 12));
		}
		return out;
	}

	@Override
	public int width(Minecraft mc) {
		return 16 + 3 + mc.font.width("999") + 2;
	}

	@Override
	public int height(Minecraft mc) {
		return Math.max(1, entries(mc).size()) * ROW;
	}

	@Override
	public void draw(Gfx g, Minecraft mc, int x, int y, boolean preview) {
		int cy = y;
		for (Entry e : entries(mc)) {
			Render2D.item(g, e.icon(), x, cy);
			Render2D.text(g, mc, String.valueOf(e.count()), x + 19, cy + 4, e.count() == 0 ? Theme.MUTED : Theme.TEXT);
			cy += ROW;
		}
	}

	@Override
	public void readOptions(JsonObject o) {
		hideZero = Opt.b(o, "hideZero", hideZero);
	}

	@Override
	public void writeOptions(JsonObject o) {
		o.addProperty("hideZero", hideZero);
	}
}
