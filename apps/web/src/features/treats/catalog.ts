/** Treat recipes and ingredients. Image paths are relative to the treat asset base (see assets.ts). */
export const INGREDIENTS = [
  {
    id: 'flour',
    name: 'Flour',
    image: 'ingredients/flour.webp'
  },
  {
    id: 'egg',
    name: 'Egg',
    image: 'ingredients/egg.webp'
  },
  {
    id: 'milk',
    name: 'Milk',
    image: 'ingredients/milk.webp'
  },
  {
    id: 'honey',
    name: 'Honey',
    image: 'ingredients/honey.webp'
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    image: 'ingredients/strawberry.webp'
  },
  {
    id: 'whipped_cream',
    name: 'Whipped Cream',
    image: 'ingredients/whipped_cream.webp'
  },
  {
    id: 'sugar',
    name: 'Sugar',
    image: 'ingredients/sugar.webp'
  },
  {
    id: 'cocoa_powder',
    name: 'Cocoa Powder',
    image: 'ingredients/cocoa_powder.webp'
  },
  {
    id: 'rainbow_sprinkles',
    name: 'Rainbow Sprinkles',
    image: 'ingredients/rainbow_sprinkles.webp'
  },
  {
    id: 'butter',
    name: 'Butter',
    image: 'ingredients/butter.webp'
  },
  {
    id: 'mango',
    name: 'Mango',
    image: 'ingredients/mango.webp'
  },
  {
    id: 'matcha_powder',
    name: 'Matcha Powder',
    image: 'ingredients/matcha_powder.webp'
  },
  {
    id: 'blueberries',
    name: 'Blueberries',
    image: 'ingredients/blueberries.webp'
  },
  {
    id: 'vanilla',
    name: 'Vanilla',
    image: 'ingredients/vanilla.webp'
  },
  {
    id: 'caramel_syrup',
    name: 'Caramel Syrup',
    image: 'ingredients/caramel_syrup.webp'
  },
  {
    id: 'peach',
    name: 'Peach',
    image: 'ingredients/peach.webp'
  },
  {
    id: 'yogurt',
    name: 'Yogurt',
    image: 'ingredients/yogurt.webp'
  },
  {
    id: 'granola',
    name: 'Granola',
    image: 'ingredients/granola.webp'
  },
  {
    id: 'mixed_berries',
    name: 'Mixed Berries',
    image: 'ingredients/mixed_berries.webp'
  },
  {
    id: 'rice_flour',
    name: 'Rice Flour',
    image: 'ingredients/rice_flour.webp'
  },
  {
    id: 'red_bean_paste',
    name: 'Red Bean Paste',
    image: 'ingredients/red_bean_paste.webp'
  },
  {
    id: 'almond_flour',
    name: 'Almond Flour',
    image: 'ingredients/almond_flour.webp'
  },
  {
    id: 'egg_whites',
    name: 'Egg Whites',
    image: 'ingredients/egg_whites.webp'
  },
  {
    id: 'rainbow_food_coloring',
    name: 'Rainbow Food Coloring',
    image: 'ingredients/rainbow_food_coloring.webp'
  },
  {
    id: 'cream_filling',
    name: 'Cream Filling',
    image: 'ingredients/cream_filling.webp'
  }
] as const

export const TREAT_RECIPES = [
  {
    id: 'honey_berry_pancake_stack',
    name: 'Honey Berry Pancake Stack',
    image: 'treats/01_honey_berry_pancake_stack.webp',
    ingredients: [
      {
        id: 'flour',
        quantity: 1,
        recipeImage: 'recipe_ingredients/01_honey_berry_pancake_stack__flour.webp'
      },
      {
        id: 'egg',
        quantity: 1,
        recipeImage: 'recipe_ingredients/01_honey_berry_pancake_stack__egg.webp'
      },
      {
        id: 'milk',
        quantity: 1,
        recipeImage: 'recipe_ingredients/01_honey_berry_pancake_stack__milk.webp'
      },
      {
        id: 'honey',
        quantity: 1,
        recipeImage: 'recipe_ingredients/01_honey_berry_pancake_stack__honey.webp'
      },
      {
        id: 'strawberry',
        quantity: 1,
        recipeImage: 'recipe_ingredients/01_honey_berry_pancake_stack__strawberry.webp'
      }
    ]
  },
  {
    id: 'strawberry_shortcake_slice',
    name: 'Strawberry Shortcake Slice',
    image: 'treats/02_strawberry_shortcake_slice.webp',
    ingredients: [
      {
        id: 'flour',
        quantity: 1,
        recipeImage: 'recipe_ingredients/02_strawberry_shortcake_slice__flour.webp'
      },
      {
        id: 'egg',
        quantity: 1,
        recipeImage: 'recipe_ingredients/02_strawberry_shortcake_slice__egg.webp'
      },
      {
        id: 'whipped_cream',
        quantity: 1,
        recipeImage: 'recipe_ingredients/02_strawberry_shortcake_slice__whipped_cream.webp'
      },
      {
        id: 'sugar',
        quantity: 1,
        recipeImage: 'recipe_ingredients/02_strawberry_shortcake_slice__sugar.webp'
      },
      {
        id: 'strawberry',
        quantity: 1,
        recipeImage: 'recipe_ingredients/02_strawberry_shortcake_slice__strawberry.webp'
      }
    ]
  },
  {
    id: 'choco_sprinkle_donut',
    name: 'Choco Sprinkle Donut',
    image: 'treats/03_choco_sprinkle_donut.webp',
    ingredients: [
      {
        id: 'flour',
        quantity: 1,
        recipeImage: 'recipe_ingredients/03_choco_sprinkle_donut__flour.webp'
      },
      {
        id: 'egg',
        quantity: 1,
        recipeImage: 'recipe_ingredients/03_choco_sprinkle_donut__egg.webp'
      },
      {
        id: 'milk',
        quantity: 1,
        recipeImage: 'recipe_ingredients/03_choco_sprinkle_donut__milk.webp'
      },
      {
        id: 'cocoa_powder',
        quantity: 1,
        recipeImage: 'recipe_ingredients/03_choco_sprinkle_donut__cocoa_powder.webp'
      },
      {
        id: 'rainbow_sprinkles',
        quantity: 1,
        recipeImage: 'recipe_ingredients/03_choco_sprinkle_donut__rainbow_sprinkles.webp'
      }
    ]
  },
  {
    id: 'mango_cream_tart',
    name: 'Mango Cream Tart',
    image: 'treats/04_mango_cream_tart.webp',
    ingredients: [
      {
        id: 'flour',
        quantity: 1,
        recipeImage: 'recipe_ingredients/04_mango_cream_tart__flour.webp'
      },
      {
        id: 'butter',
        quantity: 1,
        recipeImage: 'recipe_ingredients/04_mango_cream_tart__butter.webp'
      },
      {
        id: 'egg',
        quantity: 1,
        recipeImage: 'recipe_ingredients/04_mango_cream_tart__egg.webp'
      },
      {
        id: 'sugar',
        quantity: 1,
        recipeImage: 'recipe_ingredients/04_mango_cream_tart__sugar.webp'
      },
      {
        id: 'mango',
        quantity: 1,
        recipeImage: 'recipe_ingredients/04_mango_cream_tart__mango.webp'
      }
    ]
  },
  {
    id: 'matcha_swiss_roll',
    name: 'Matcha Swiss Roll',
    image: 'treats/05_matcha_swiss_roll.webp',
    ingredients: [
      {
        id: 'flour',
        quantity: 1,
        recipeImage: 'recipe_ingredients/05_matcha_swiss_roll__flour.webp'
      },
      {
        id: 'egg',
        quantity: 1,
        recipeImage: 'recipe_ingredients/05_matcha_swiss_roll__egg.webp'
      },
      {
        id: 'whipped_cream',
        quantity: 1,
        recipeImage: 'recipe_ingredients/05_matcha_swiss_roll__whipped_cream.webp'
      },
      {
        id: 'sugar',
        quantity: 1,
        recipeImage: 'recipe_ingredients/05_matcha_swiss_roll__sugar.webp'
      },
      {
        id: 'matcha_powder',
        quantity: 1,
        recipeImage: 'recipe_ingredients/05_matcha_swiss_roll__matcha_powder.webp'
      }
    ]
  },
  {
    id: 'blueberry_muffin',
    name: 'Blueberry Muffin',
    image: 'treats/06_blueberry_muffin.webp',
    ingredients: [
      {
        id: 'flour',
        quantity: 1,
        recipeImage: 'recipe_ingredients/06_blueberry_muffin__flour.webp'
      },
      {
        id: 'egg',
        quantity: 1,
        recipeImage: 'recipe_ingredients/06_blueberry_muffin__egg.webp'
      },
      {
        id: 'milk',
        quantity: 1,
        recipeImage: 'recipe_ingredients/06_blueberry_muffin__milk.webp'
      },
      {
        id: 'blueberries',
        quantity: 1,
        recipeImage: 'recipe_ingredients/06_blueberry_muffin__blueberries.webp'
      },
      {
        id: 'butter',
        quantity: 1,
        recipeImage: 'recipe_ingredients/06_blueberry_muffin__butter.webp'
      }
    ]
  },
  {
    id: 'caramel_flan_cup',
    name: 'Caramel Flan Cup',
    image: 'treats/07_caramel_flan_cup.webp',
    ingredients: [
      {
        id: 'egg',
        quantity: 1,
        recipeImage: 'recipe_ingredients/07_caramel_flan_cup__egg.webp'
      },
      {
        id: 'milk',
        quantity: 1,
        recipeImage: 'recipe_ingredients/07_caramel_flan_cup__milk.webp'
      },
      {
        id: 'sugar',
        quantity: 1,
        recipeImage: 'recipe_ingredients/07_caramel_flan_cup__sugar.webp'
      },
      {
        id: 'vanilla',
        quantity: 1,
        recipeImage: 'recipe_ingredients/07_caramel_flan_cup__vanilla.webp'
      },
      {
        id: 'caramel_syrup',
        quantity: 1,
        recipeImage: 'recipe_ingredients/07_caramel_flan_cup__caramel_syrup.webp'
      }
    ]
  },
  {
    id: 'peach_yogurt_parfait',
    name: 'Peach Yogurt Parfait',
    image: 'treats/08_peach_yogurt_parfait.webp',
    ingredients: [
      {
        id: 'peach',
        quantity: 1,
        recipeImage: 'recipe_ingredients/08_peach_yogurt_parfait__peach.webp'
      },
      {
        id: 'yogurt',
        quantity: 1,
        recipeImage: 'recipe_ingredients/08_peach_yogurt_parfait__yogurt.webp'
      },
      {
        id: 'granola',
        quantity: 1,
        recipeImage: 'recipe_ingredients/08_peach_yogurt_parfait__granola.webp'
      },
      {
        id: 'honey',
        quantity: 1,
        recipeImage: 'recipe_ingredients/08_peach_yogurt_parfait__honey.webp'
      },
      {
        id: 'mixed_berries',
        quantity: 1,
        recipeImage: 'recipe_ingredients/08_peach_yogurt_parfait__mixed_berries.webp'
      }
    ]
  },
  {
    id: 'moon_mochi',
    name: 'Moon Mochi',
    image: 'treats/09_moon_mochi.webp',
    ingredients: [
      {
        id: 'rice_flour',
        quantity: 1,
        recipeImage: 'recipe_ingredients/09_moon_mochi__rice_flour.webp'
      },
      {
        id: 'milk',
        quantity: 1,
        recipeImage: 'recipe_ingredients/09_moon_mochi__milk.webp'
      },
      {
        id: 'sugar',
        quantity: 1,
        recipeImage: 'recipe_ingredients/09_moon_mochi__sugar.webp'
      },
      {
        id: 'red_bean_paste',
        quantity: 1,
        recipeImage: 'recipe_ingredients/09_moon_mochi__red_bean_paste.webp'
      },
      {
        id: 'strawberry',
        quantity: 1,
        recipeImage: 'recipe_ingredients/09_moon_mochi__strawberry.webp'
      }
    ]
  },
  {
    id: 'rainbow_macaron_stack',
    name: 'Rainbow Macaron Stack',
    image: 'treats/10_rainbow_macaron_stack.webp',
    ingredients: [
      {
        id: 'almond_flour',
        quantity: 1,
        recipeImage: 'recipe_ingredients/10_rainbow_macaron_stack__almond_flour.webp'
      },
      {
        id: 'egg_whites',
        quantity: 1,
        recipeImage: 'recipe_ingredients/10_rainbow_macaron_stack__egg_whites.webp'
      },
      {
        id: 'sugar',
        quantity: 1,
        recipeImage: 'recipe_ingredients/10_rainbow_macaron_stack__sugar.webp'
      },
      {
        id: 'rainbow_food_coloring',
        quantity: 1,
        recipeImage: 'recipe_ingredients/10_rainbow_macaron_stack__rainbow_food_coloring.webp'
      },
      {
        id: 'cream_filling',
        quantity: 1,
        recipeImage: 'recipe_ingredients/10_rainbow_macaron_stack__cream_filling.webp'
      }
    ]
  }
] as const

export type IngredientId = (typeof INGREDIENTS)[number]['id']
export type TreatId = (typeof TREAT_RECIPES)[number]['id']
export const ingredientById = Object.fromEntries(INGREDIENTS.map((item) => [item.id, item])) as Record<IngredientId, (typeof INGREDIENTS)[number]>
export const treatById = Object.fromEntries(TREAT_RECIPES.map((item) => [item.id, item])) as Record<TreatId, (typeof TREAT_RECIPES)[number]>
