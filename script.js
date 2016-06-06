// Structure of items.
//var items = [{
//    id: "",
//    entityType: "",
//    rarity: 1,
//    type: "",
//    subType: "",
//    ts: 0,
//    plus: 0,
//    ageLevel: 0,
//    handed: 1,
//    stats: {
//        hp: 0,
//        attackMin: 0,
//        attackMax: 0,
//        defense: 0,
//        overkill: 0,
//        heal: 0,
//        hpBonus: 0
//    },
//    name: "", // {Helmet, Armor, Gloves, Leggings, Boots, Sword, 2-handed Sword, Bow, Crossbow, Wand, Staff, Shield}
//
//}];

/** ============= Battle INF Script to End All Scripts ==========
 * Authored by Sam 'Halithor' Marquart.
 * Licenced under MIT (https://opensource.org/licenses/MIT).
 *
 * Features:
 * - Sells items below a threshold.
 * - Crafts new items into equipped items and, optionally, inventory items.
 *      + Inventory items is useful for getting higher rarity gear to be more powerful than current gear
 * - Equips items that are better than currently equipped items.
 * - Sells items that have reached maximum Plus, and aren't better than the currently equipped item of that type.
 * - Dips all of your items into the fountain, automagically, to increase the age modifiers.
 * - Removes duplicate items of a given type, leaving only the strongest.
 *
 * Notes:
 * - Only works on items you have gained after you include the script. It will not fix your inventory.
 * -
 */
(function () {
    // Settings for the game. Edit these to fit your character better.
    var settings = {
        version: 1.0,
        openInvSlots: 2, // The number of spots that will ALWAYS be held open in your inventory. I recommend setting this to the drops you get per cycle.
        sellBelow: 2, // The threshold below which we automatically sell (exclusive), without combining. Increase this as you like.
        keepAbove: 4, // The rarity above which we DO NOT ever auto sell (exclusive).
        keepAge: 6, // Age level which to NEVER sell above. 6 is two days (Master).
        craftInventory: true, // Whether or not to craft items in your inventory.
        sellDuplicateInventory: true, // If we should sell any duplicates of a given item type in the inventory, and only keep the strongest item.
        forceEquipHighestStrength: false // If you always want to equip the highest rarity, no matter the stats. I recommend this to be true if you don't craft the inventory.
    };

    var _rarities = ["None", "Gray", "Green", "Blue", "Red", "Orange", "Purple", "Teal"];
    var _ages = ["Worn", "Fine", "Refined", "Aged", "Exotic", "Famous", "Master", "Heroic", "Ancient", "Fabled", "Ascended", "Legendary", "Eternal"];


    function postMessage(text) {
        console.log(text);
        API.notifications.create("" + text, 10);
    }

    // String that displays most info about an item.
    function getItemString(item) {
        return '<i class="fa fa-star"></i>' + item.rarity + "." + item.mod + " " + _ages[item.ageLevel] + " " + item.name + " +" + item.plus;
    }

    // Calculates the relative starting strength of an item.
    function getItemStrength(item) {
        return (item.mod * 2) + item.rarity;
    }

    function isItemAtMaxPlus(item) {
        return item.plus >= (5 + item.rarity * 5);
    }

    function isSameItemType(first, second) {
        return first.type == second.type && first.subType == second.subType
    }

    // Returns if two items are compatible for crafting.
    function canCraftItems(first, second) {
        return isSameItemType(first, second)
            && first.rarity == second.rarity
            && first.mod == second.mod;
    }

    // Tries to find a good item from items for secondary to combined into. Picks the first one found.
    function findPrimaryCraft(items, secondary) {
        for (var j = 0; j < items.length; j++) {
            var candidate = items[j];
            if (canCraftItems(candidate, secondary) && !isItemAtMaxPlus(candidate)) {
                return candidate;
            }
        }
        return undefined;
    }

    // Less picky than find primary craft. Used for inventory duplicates.
    function findDuplicateTypes(items, item) {
        var duplicates = [];
        for (var j = 0; j < items.length; j++) {
            var candidate = items[j];
            if (isSameItemType(item, candidate)) {
                duplicates.push(candidate);
            }
        }
        if (duplicates.length > 0) {
            return duplicates;
        }
        return undefined;
    }

    // Will the additional items push the inventory to full?
    function getInventoryFull(itemsLeft) {
        if (!itemsLeft) {
            itemsLeft = settings.openInvSlots;
        }
        var val = (ScriptAPI.$user.inventory.items.length + itemsLeft >= ScriptAPI.$user.upgrades.inventoryMax.value);
        console.log("getInventoryFull: " + val);
        return val;
    }

    function getSortedInventory() {
        return ScriptAPI.$user.inventory.items.sort(function (a, b) {
            if (getItemStrength(a) == getItemStrength(b)) {
                if (a.plus == b.plus) {
                    if (a.ageLevel == b.ageLevel) {
                        return 0;
                    } else {
                        return a.ageLevel > b.ageLevel ? -1 : 1;
                    }
                } else {
                    return a.plus > b.plus ? -1 : 1;
                }
            } else {
                return getItemStrength(a) > getItemStrength(b) ? -1 : 1;
            }
        });
    }


    // Find the item equipped matching the given item.
    function findEquipped(primary) {
        var equipment = ScriptAPI.$user.character.equipment;
        for (var i in equipment) {
            var candidate = equipment[i];
            if (isSameItemType(primary, candidate)) {
                return candidate;
            }
        }
        return undefined;
    }

    // Returns true if first is better than second. False otherwise.
    // Does not care about rarity, age, etc. Purely based on stats.
    // This is one of the things you can change to value items differently!
    function isItemBetter(first, second) {
        if (!isSameItemType(first, second)) {
            return false; // Don't even compare if not the same.
        }

        if (first.type == "weapon") {
            // Damage consideration
            var damageFirst = (first.stats.attackMax + first.stats.attackMin) / 2;
            var damageSecond = (second.stats.attackMax + second.stats.attackMin) / 2;
            var damageRatio = damageSecond > 0 ? damageFirst / damageSecond : 1.0;
            // Overkill consideration
            var overkillDiff = first.stats.overkill - second.stats.overkill;
            // Healing ratio.
            var healRatio = second.stats.heal > 0 ? (first.stats.heal / second.stats.heal) : 1.0;
            var armorRatio = second.stats.defense > 0 ? first.stats.defense / second.stats.defense : 1.0;
            var hpBonusDiff = (first.hpBonus - second.hpBonus);
            return damageRatio + healRatio + armorRatio + (overkillDiff / 15) + (hpBonusDiff / 50) > 3.0;
        } else {
            // Everything that's not a weapon is armor.
            var armorRatio = first.stats.defense / second.stats.defense;
            var hpBonusDiff = (first.hpBonus - second.hpBonus);
            return armorRatio + (hpBonusDiff / 50) > 1.0;
        }
    }

    function isItemStronger(first, second) {
        return getItemStrength(first) > getItemStrength(second);
    }

    // Sells an item, only checking age.
    function sellItem(item) {
        if (item.ageLevel < 6) {
            postMessage("Selling " + getItemString(item));
            API.inventory.sell(item);
        }
    }

    // Sells an item if it's at the max level.
    function sellIfMax(item) {
        if (isItemAtMaxPlus(item) && item.rarity <= settings.keepAbove) {
            sellItem(item);
            return true;
        }
        return false;
    }

    // Sells the inventory item in the last occupied location, sorted by strength.
    function sellLastInventoryItem() {
        var item = getSortedInventory()[ScriptAPI.$user.upgrades.inventoryMax.value - 1];
        if (item) {
            sellItem(item);
        }
    }

    // Similar to above, but forces the spots open based on the setting
    function openLastInventorySpots() {
        var inv = getSortedInventory();
        for (var i = 0; i < settings.openInvSlots; i++) {
            var item = inv[ScriptAPI.$user.upgrades.inventoryMax.value - 1 - i];
            if (item) {
                sellItem(item);
            }
        }
    }

    // Tries to equip the item if better. Returns the unequiped item if it works, false otherwise.
    function equipIfBetter(item, callback) {
        var equip = findEquipped(item);

        if (equip && (isItemBetter(item, equip) || (settings.forceEquipHighestStrength && isItemStronger(item, equip)) )) {
            postMessage("Changed equipped " + equip.type + ":" + equip.subType);
            API.inventory.unequip(equip, function () {
                API.inventory.equip(item, function () {
                    if (callback) {
                        callback(equip);
                    }
                });
            });
            return equip;
        }
        if (callback) {
            callback(false);
        }
        return false;
    }
    // Get a sorted list of the inventory items.
    var inventory = getSortedInventory();

    // Get the equipment
    var equipment = ScriptAPI.$user.character.equipment;

    var itemsLeft = items.length;
    items.forEach(function (item) {

        if (item.rarity < settings.sellBelow && !(item.rarity > settings.keepAbove)) {
            itemsLeft--;
            sellItem(item);
            return;
        }

        // Now we want to combine the item with the inventory into more powerful items. First, we want to upgrade your currently
        // equipped items fully. Then we want to try to combine between items in your inventory. After combining, we look to see
        // if any of the items we have are better than equipped, if so, switch them. Finally, if anything has
        // reached the max Plus value that it can, and it isn't equipped,  sell it.

        // Find a good candidate to craft this item into.
        var isEquipped = false;
        var primary = findPrimaryCraft(equipment, item);
        if (primary) isEquipped = true;

        if (!primary && settings.craftInventory) {
            primary = findPrimaryCraft(inventory, item);
        }

        if (primary) {
            // We can craft this into something.
            itemsLeft--;
            postMessage("Crafting " + getItemString(primary) + (isEquipped ? " [equipped]" : " [inventory]") + " with " + getItemString(item));
            API.inventory.craft(primary, item); // TODO bind this callback

            // Primary has now been upgraded. Compare it to the currently equipped piece of equipment, and if it wins, equip it.
            if (!isEquipped) {
                var unequippedItem = equipIfBetter(primary);
                // If we changed equipment, try to sell the un-equipped item.
                if (unequippedItem) {
                    if (sellIfMax(unequippedItem)) {
                        itemsLeft--;
                    }
                } else {
                    if (sellIfMax(primary)) {
                        itemsLeft--;
                    }
                }
            }
        } else {
            // Deal with the new item.

            // First try to equip it.
            var unequippedItem = equipIfBetter(item);
            if (unequippedItem) {
                if (sellIfMax(unequippedItem)) {
                    itemsLeft--;
                    return;
                } else {
                    if (getInventoryFull(itemsLeft)) {
                        sellLastInventoryItem();
                        itemsLeft--;
                    }
                }
            }
            // Now look at the inventory and remove any duplicates.
            if (settings.sellDuplicateInventory) {
                // Use the unequipped item for the duplicates.
                if (unequippedItem) {
                    item = unequippedItem;
                }
                // Remove all duplicates in the inventory.
                var duplicates = findDuplicateTypes(inventory, item);
                var tempItem = item;
                if (duplicates) {
                    for (var i = 0; i < duplicates.length; i++) {
                        var dup = duplicates[i];
                        if (isItemStronger(item, dup)) {
                            sellItem(dup);
                        } else {
                            sellItem(tempItem);
                            tempItem = dup;
                        }
                        itemsLeft--;
                    }
                }
            }
        }
    });

    // Given our current inventory, sell stuff to keep some slots open. Hopefully, these slots will
    if (getInventoryFull()) {
        openLastInventorySpots();
    }

    // Age up everything that we own, if possible.
    inventory.forEach(ScriptAPI.$craftingService.ageUpItem);
    equipment.forEach(ScriptAPI.$craftingService.ageUpItem);

}());