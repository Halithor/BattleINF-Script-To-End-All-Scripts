/** ============= Battle INF Script to End All Scripts ==========
 * Authored by Sam 'Halithor' Marquart.
 * Version 1.2.
 * Licenced under MIT (https://opensource.org/licenses/MIT).
 *
 * Features:
 * - Sells items below a threshold.
 * - Crafts new items into equipped items and, optionally, inventory items.
 *      + Inventory items is useful for getting higher rarity gear to be more powerful than current gear
 * - Equips items that are better than currently equipped items.
 * - Sells items that have reached maximum Plus, and aren't better than the currently equipped item of that type.
 *      + Sends items to the market if they're above the threshold.
 * - Dips all of your items into the fountain, automagically, to increase the age modifiers.
 * - Removes duplicate items of a given type, leaving only the strongest in your inventory.
 *
 * Notes:
 * - Only works on items you have gained after you include the script. It will not fix your inventory.
 * -
 */
(function () {
    items = items || [];
    // Settings for the game. Edit these to fit your character better.
    var settings = {
        sellBelow: 2, // The threshold below which we automatically sell (exclusive), without combining. Increase this as you like.
        keepAbove: 4, // The rarity above which we DO NOT ever auto sell (exclusive).
        sendToMarketAbove: 4, // The rarity above which instead of selling at max, we send the item to the market. OVERRIDES keepAbove
        openInvSlots: 2, // The number of spots that will ALWAYS be held open in your inventory. I recommend setting this to the drops you get per cycle.
        keepAge: 6, // Age level which to NEVER sell above. 6 is two days (Master).
        craftInventory: true, // Whether or not to craft items in your inventory.
        sellDuplicateInventory: false, // If we should sell any duplicates of a given item type in the inventory, and only keep the strongest item. THIS IS DANGEROUS
        forceEquipHighestStrength: false // If you always want to equip the highest rarity, no matter the stats. I recommend this to be true if you don't craft the inventory.
    };

    var _rarities = ["None", "Gray", "Green", "Blue", "Red", "Orange", "Purple", "Teal"];
    var _rarityColor = ["white", "#666", "#4CAF50", "#2196F3", "#F44336", "#FF9800", "#9C27B0", "#E91E63"];
    var _ages = ["Worn", "Fine", "Refined", "Aged", "Exotic", "Famous", "Master", "Heroic", "Ancient", "Fabled", "Ascended", "Legendary", "Eternal"];
    var _ageThresholds = [0, 900000, 1800000, 3600000, 7200000, 86400000, 172800000, 345600000, 691200000, 1382400000, 2764800000, 5529600000, 11059200000];

    function postMessage(text) {
        //console.log(text);
        API.notifications.create("" + text, 10);
    }

    // String that displays most info about an item.
    function getItemString(item) {
        return '<span style="color: ' + _rarityColor[item.rarity] + ';"><i class="fa fa-star"></i>' + item.rarity + "." + item.mod + " " + _ages[item.ageLevel] + " " + item.name + " +" + item.plus + "</span>";
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

    function isItemEquipped(item) {
        var equipment = ScriptAPI.$user.character.equipment;
        for (var i in equipment) {
            if (equipment[i].id == item.id) {
                return true;
            }
        }
        return false;
    }

    // Returns if two items are compatible for crafting.
    function canCraftItems(first, second) {
        return isSameItemType(first, second)
            && first.rarity == second.rarity
            && first.mod == second.mod;
    }

    function sendItemToMarket(item) {
        API.market.addToMarket(item);
    }

    function getItemAgeLevel(item) {
        var now = Math.round(new Date().getTime());
        var diff = now - item.ts;
        var i = 0;
        while (diff > _ageThresholds[i] && i < _ageThresholds.length) {
            i++;
        }
        return i - 1; // Off by one based on the iteration.
    }

    // Find all options for crafting.
    function findCraftingCandidates(items, secondary) {
        var candidates = [];
        for (var j = 0; j < items.length; j++) {
            var candidate = items[j];
            if (canCraftItems(candidate, secondary) && !isItemAtMaxPlus(candidate)) {
                candidates.push(candidate);
            }
        }
        return candidates;
    }

    function craftCandidates(candidates, item) {
        var canIndex = 0;

        function callback(data) {
            if (!data.success) {
                canIndex++;
                if (canIndex < candidates.length) {
                    API.inventory.craft(candidates[canIndex], item, callback);
                }
                return;
            }

            var newItem = data.newItem;

            postMessage("<b>Crafting:</b> " + getItemString(newItem));

            if (!isItemEquipped(newItem)) {
                var unequippedItem = equipIfBetter(newItem);
                // If we changed equipment, try to sell the un-equipped item.
                if (unequippedItem) {
                    sellIfMax(unequippedItem);
                } else {
                    sellIfMax(newItem);
                }
            }
        }

        API.inventory.craft(candidates[canIndex], item, callback);
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
            healRatio = healRatio == 0 ? 1.0 : healRatio;

            var armorRatio = second.stats.defense > 0 ? first.stats.defense / second.stats.defense : 1.0;
            if (first.stats.defense == 0 || second.stats.defense == 0) {
                armorRatio = 1.0; // Don't compare on something one item doesn't have.
            }

            var hpBonusDiff = (first.stats.hpBonus - second.stats.hpBonus);

            var weaponValue = damageRatio + healRatio + armorRatio + (overkillDiff / 15) + (hpBonusDiff / 50);
            return weaponValue > 3.0;
        } else {
            // Everything that's not a weapon is armor.
            var armorRatio = first.stats.defense / second.stats.defense;
            var hpBonusDiff = (first.stats.hpBonus - second.stats.hpBonus);

            var armorValue = armorRatio + (hpBonusDiff / 50);
            return armorValue > 1.0;
        }
    }

    function isItemStronger(first, second) {
        return getItemStrength(first) > getItemStrength(second);
    }

    // Sells an item, only checking age.
    function sellItem(item) {
        if (getItemAgeLevel(item) < settings.keepAge && !item.lock) {
            //postMessage("Selling " + getItemString(item));
            API.inventory.sell(item);
        }
    }

    // Sells an item if it's at the max level.
    function sellIfMax(item) {
        if (isItemAtMaxPlus(item)) {
            if (item.rarity > settings.sendToMarketAbove) {
                postMessage("<b>Market Max:</b> " + getItemString(item));
                sendItemToMarket(item);
            } else if (item.rarity <= settings.keepAbove) {
                postMessage("<b>Selling Max:</b> " + getItemString(item));
                sellItem(item);
            }
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
        var equipped = findEquipped(item);

        if (equipped && (isItemBetter(item, equipped) || (settings.forceEquipHighestStrength && isItemStronger(item, equipped)) )) {
            postMessage("<b>Equip:</b> " + equipped.name + " to " + getItemString(item));
            //API.inventory.unequip(equipped);
            API.inventory.equip(item);
            return equipped;
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
        var candidates = findCraftingCandidates(equipment, item);

        if (settings.craftInventory) {
            candidates = candidates.concat(findCraftingCandidates(inventory, item));
        }

        if (candidates.length > 0) {
            // We can craft this into something.
            craftCandidates(candidates, item);
        } else {
            // Deal with the new item.

            // First try to equip it.
            var unequippedItem = equipIfBetter(item);
            if (unequippedItem) {
                if (sellIfMax(unequippedItem)) {
                    itemsLeft--;
                    return;
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

    var now = Math.floor(new Date().getTime());

    function checkAgeAndAgeUp(item) {
        console.log("AGE: " + (now - item.ts) + " : " + _ageThresholds[item.ageLevel + 1]);
        console.log(item);
        if ((now - item.ts) > _ageThresholds[item.ageLevel + 1]) {
            ScriptAPI.$craftingService.ageUpItem(item);
        }
    }

    // Age up everything that we own, if possible.
    inventory.forEach(checkAgeAndAgeUp);
    equipment.forEach(checkAgeAndAgeUp);

}());