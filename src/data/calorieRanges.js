// Calorie adjustment slider ranges (kcal/day), shared by Onboarding and Profile.
//
// Surplus is anchored to Mentzer's own figure (mentzer_nutrition.txt): 10 lb of
// muscle a year ≈ 6,000 extra kcal ≈ 16 kcal/day above maintenance.
export const SURPLUS_RANGE = { min: 16, max: 200, step: 8, default: 16 };

// Deficit is not specified by Mentzer; kept as the app's existing range.
export const DEFICIT_RANGE = { min: 100, max: 500, step: 50, default: 300 };
