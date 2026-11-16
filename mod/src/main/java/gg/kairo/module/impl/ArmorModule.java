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
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

/** Armadura vestida + item na mão, com a durabilidade de cada peça. */
public final class ArmorModule extends HudModule {
	private static final int ROW = 17;
	private static final EquipmentSlot[] SLOTS = {
			EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND
	};

	private boolean percent = false;
	private boolean horizontal = false;
	private boolean showHand = true;

	public ArmorModule() {
		super("armor", "Armadura", "Peças vestidas e item na mão com a durabilidade.", true, 4, 210);
		defaultAnchor(0.0, 0.62);
	}

	private List<ItemStack> stacks(Minecraft mc) {
		List<ItemStack> out = new ArrayList<>();
		LocalPlayer p = mc.player;
		if (p == null) {
			out.add(new ItemStack(Items.DIAMOND_HELMET));
			out.add(new ItemStack(Items.DIAMOND_CHESTPLATE));
			out.add(new ItemStack(Items.DIAMOND_LEGGINGS));
			out.add(new ItemStack(Items.DIAMOND_BOOTS));
			if (showHand) out.add(new ItemStack(Items.DIAMOND_SWORD));
			return out;
		}
		for (EquipmentSlot slot : SLOTS) {
			if (slot == EquipmentSlot.MAINHAND && !showHand) continue;
			ItemStack s = p.getItemBySlot(slot);
			if (!s.isEmpty()) out.add(s);
		}
		if (out.isEmpty() && editing) {
			out.add(new ItemStack(Items.DIAMOND_HELMET));
			out.add(new ItemStack(Items.DIAMOND_CHESTPLATE));
		}
		return out;
	}

	private String label(ItemStack s) {
		if (!s.isDamageableItem()) return s.getCount() > 1 ? String.valueOf(s.getCount()) : "";
		int left = s.getMaxDamage() - s.getDamageValue();
		return percent ? Math.round(left * 100f / s.getMaxDamage()) + "%" : String.valueOf(left);
	}

	private int cell(Minecraft mc) {
		return 16 + 3 + Math.max(mc.font.width("1561"), mc.font.width("100%"));
	}

	@Override
	public int width(Minecraft mc) {
		int n = Math.max(1, stacks(mc).size());
		return horizontal ? n * (cell(mc) + 2) : cell(mc);
	}

	@Override
	public int height(Minecraft mc) {
		int n = Math.max(1, stacks(mc).size());
		return horizontal ? ROW : n * ROW;
	}

	@Override
	public void draw(Gfx g, Minecraft mc, int x, int y, boolean preview) {
		List<ItemStack> list = stacks(mc);
		int cx = x;
		int cy = y;
		for (ItemStack s : list) {
			Render2D.item(g, s, cx, cy);
			String text = label(s);
			int color = s.isDamageableItem()
					? Render2D.durabilityColor((s.getMaxDamage() - s.getDamageValue()) / (float) s.getMaxDamage())
					: Theme.TEXT;
			Render2D.text(g, mc, text, cx + 19, cy + 4, color);
			if (horizontal) cx += cell(mc) + 2;
			else cy += ROW;
		}
	}

	@Override
	public void readOptions(JsonObject o) {
		percent = Opt.b(o, "percent", percent);
		horizontal = Opt.b(o, "horizontal", horizontal);
		showHand = Opt.b(o, "showHand", showHand);
	}

	@Override
	public void writeOptions(JsonObject o) {
		o.addProperty("percent", percent);
		o.addProperty("horizontal", horizontal);
		o.addProperty("showHand", showHand);
	}
}
