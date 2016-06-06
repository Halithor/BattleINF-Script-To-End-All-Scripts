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
 * - Crafts new items into equipped items and optionally, inventory items.
 * - Equips items that are better than currently equipped items.
 */

// Settings for the game. Edit these to fit your character better.
var settings = {
    version: 1.0,
    sellBelow: 2, //< The threshold below which we automatically sell, without combining. Increase this as you like.
    keepAtMax: 4, // The rarity that we DO NOT ever auto sell at.
    craftInventory: true, // Whether or not to craft items in your inventory.
    forceEquipHighestRarity: false // If you always want to equip the highest rarity, no matter the stats. I recommend this to be true if you don't craft the inventory.
};

var _rarities = ["None", "Gray", "Green", "Blue", "Red", "Orange", "Purple", "Teal"];
var _ages = ["Worn" , "Fine", "Refined", "Aged", "Exotic", "Famous", "Master", "Heroic", "Ancient", "Fabled", "Ascended", "Legendary", "Eternal"];

function postMessage(text) {
    console.log(text);
    API.notifications.create("SteaS: " + text, 10);
}

function getItemString(item) {
    return '<i class="fa fa-star"></i>' + item.rarity + " " + _ages[item.ageLevel] + " " + item.name  + " +" + item.plus;
}

function isItemAtMaxPlus(item) {
    return item.plus >= (5 + item.rarity * 5);
}

function isSameItemType(first, second) {
    return first.type == second.type && first.subType == second.subType
}

// Tries to find a good item from items for secondary to combined into. Picks the first one found.
function findPrimaryCraft(items, secondary) {
    for (var j = 0; j < items.length; j++) {
        var candidate = items[j];
        if (candidate.name == secondary.name
            && candidate.rarity == secondary.rarity
            && !isItemAtMaxPlus(candidate)) {
            return candidate;
        }
    }
}



// Find the item equipped of a given type.
function findEquipped(equipment, primary) {
    for (var i in equipment) {
        var candidate = equipment[i];
        if (isSameItemType(primary, candidate)) {
            return candidate;
        }
    }
}

// Returns true if first is better than second. False otherwise.
// Does not care about rarity, age, etc. Purely based on stats.
function isItemBetter(first, second) {
    if (!isSameItemType(first, second)) {
        return false; // Don't even compare if not the same.
    }

    switch (first.subType) {
        case 'SHIELD':
        case 'ARMOR':
            var armorRatio = first.stats.defense / second.stats.defense;
            var hpBonusDiff = (first.hpBonus - second.hpBonus);
            return armorRatio + (hpBonusDiff/50) > 1.0;
        case 'SWORD':
        case 'TWO_HANDED_SWORD':
        case 'BOW':
        case 'CROSSBOW':
            var damageFirst = (first.stats.attackMax + first.stats.attackMin) / 2;
            var damageSecond = (second.stats.attackMax + second.stats.attackMin) / 2;
            var damageRatio = damageFirst / damageSecond;
            var overkillDiff = first.stats.overkill - second.stats.overkill;
            return damageRatio + (overkillDiff / 20) > 1.0;
        case "STAFF":
        case "WAND":
            var healRatio = (first.stats.heal / second.stats.heal);
            return healRatio > 1.0;
        default: // Uncomparable, make no assumptions.
            return false;
    }
}

function isItemRarer(first, second) {
    return first.rarity > second.rarity;
}

// Sells an item if it's at the max level.
function sellIfMax(item) {
    if (isItemAtMaxPlus(item) && item.rarity <= settings.keepAtMax) {
        postMessage("Selling " + getItemString(item));
        API.inventory.sell(item);
    }
}

// Tries to equip the item if better. Returns the unequiped item if it works, false otherwise.
function equipIfBetter(item, callback) {
    var equipment = ScriptAPI.$user.character.equipment;
    var equip = findEquipped(equipment, item);

    if (equip && (isItemBetter(item, equip) || (settings.forceEquipHighestRarity && isItemRarer(item, equip)) ) ) {
        postMessage("Changed equipped " + equip.type + ":" + equip.subType);
        API.inventory.unequip(equip, function() {
            API.inventory.equip(item, function() {
                callback(equip);
            });
        });
    }
    if (callback) {
        callback(false);
    }
}

// Get a sorted list of the inventory items.
var inventory = ScriptAPI.$user.inventory.items.sort(function (a, b) {
    if (a.rarity == b.rarity) {
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
        return a.rarity > b.rarity ? -1 : 1;
    }
});

// Get the equipment
var equipment = ScriptAPI.$user.character.equipment;

items.forEach(function (item) {

    if (item.rarity < settings.sellBelow) {
        postMessage('Selling ' + getItemString(item));
        API.inventory.sell(item);
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
        postMessage("Crafting " + getItemString(primary) + (isEquipped ? " [equipped]" : " [inventory]") + " with " + getItemString(item));
        API.inventory.craft(primary, item);

        // Primary has now been upgraded. Compare it to the currently equipped piece of equipment, and if it wins, equip it.
        if (!isEquipped) {
            equipIfBetter(primary, function(unequippedItem) {
                // If we changed equipment, try to sell the un-equipped item.
                if (unequippedItem) {
                    sellIfMax(unequippedItem);
                } else {
                    sellIfMax(primary);
                }
            });
        }
    } else {
        equipIfBetter(item, function (unequippedItem) {
            if (unequippedItem) {
                sellIfMax(unequippedItem);
            }
        });
    }
});

// Age up everything that we own, if possible.
inventory.forEach(ScriptAPI.$craftingService.ageUpItem);
equipment.forEach(ScriptAPI.$craftingService.ageUpItem);

