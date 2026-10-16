from .models import Profile, Goals


def suggest_goals(profile: Profile) -> Goals:
    """Mifflin–St Jeor; activity multiplier; conservative +/- 500 kcal adjustment."""
    if profile.current_weight < 40 or profile.goal_weight < 40 or profile.height_cm < 100:
        raise ValueError('Please check your measurements and units before calculating a target.')
    kg = profile.current_weight * .45359237
    bmr = 10 * kg + 6.25 * profile.height_cm - 5 * profile.age + (5 if profile.sex == 'male' else -161)
    adjustment = max(-500, min(500, profile.weekly_change * 500))
    calories = round(bmr * profile.activity + adjustment)
    # Avoid generating extreme defaults from implausible inputs. No automatic target changes.
    if not 1200 <= calories <= 6000:
        raise ValueError('These details produce an unusual target. Check your height, weight and activity before continuing.')
    protein = round(kg * 2)
    fat = round(calories * .25 / 9)
    carbs = round((calories - protein * 4 - fat * 9) / 4)
    if carbs < 0:
        raise ValueError('Please check your measurements before calculating a target.')
    return Goals(calories=calories, protein=protein, carbs=carbs, fat=fat,
                 goal_weight=profile.goal_weight, objective=profile.objective)
