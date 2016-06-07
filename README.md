# Halithor's Script to End All Scripts
An advanced script which handles item management for the game Battle INF (http://battleinf.com). Free for anyone to use or modfiy. 

## Features:
- Sells items below a threshold.
- Crafts new items into equipped items and, optionally, inventory items.
    + Inventory items is useful for getting higher rarity gear to be more powerful than current gear
- Equips items that are better than currently equipped items.
- Sells items that have reached maximum Plus, and aren't better than the currently equipped item of that type.
- Dips all of your items into the fountain, automagically, to increase the age modifiers.

## How to use
1. Log into your account on Battle Inf.
2. Click the "Scripts" tab on the top menu.
3. Paste the contents of this script into the text box.
4. Hit save.
5. Profit! (Note: it will only work on items you gain from this point on).

## Settings
Here's a quick rundown of the settings and what they do.

| Setting                   | Type | Description |
| ------------------------- | ---- | ----------- |
| sellBelow                 | int  | This is the RARITY below which we sell an item without even looking at it when we get it. Exclusive. This is your most basic of script features. |
| keepAbove                 | int  | This is the RARITY above which we never directly sell. Exclusive. Send to Market overrides this. |
| sendToMarketAbove         | int  | Above this rarity, items that reach max plus value will be automagically sent to the market. Overrides the keepAbove property. Does not set a sell price. |
| openInvSlots              | int  | How many inventory slots to try to keep open at all times. The script will attempt to sell the lowest rarity and mod items in your inventory to open these slots. | 
| keepAge                   | int  | This is a safety setting. The script will never sell any items above this age. Note it is in ageLevel (dips in the well), so 6 is two days (Master). |
| craftInventory            | bool | Whether or not to upgrade items in your inventory. The script will always try to upgrade equipped items first, then try items in your inventory. |
| sellDuplicateInventory    | bool | Whether or not to sell duplicate items. **WARNING** will sell a lot of items in your inventory. This makes sure that you only have a single item of type in your inventory (Sword, Bow, Helmet, etc), and sells every other item. It will sell the *lowest strength* item in your inventory, which is based on zone and rarity. Useful if you have a very low number of inventory spots. |

## Features to Add
