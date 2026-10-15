from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

class Food(Model):
    name: str = Field(min_length=1, max_length=200)
    grams: float = Field(gt=0, le=10000)
    calories: float = Field(ge=0, le=20000)
    protein: float = Field(ge=0, le=2000)
    carbs: float = Field(ge=0, le=2000)
    fat: float = Field(ge=0, le=2000)
    confidence: Literal['low', 'medium', 'high'] = 'low'
    uncertainty: str = Field(default='Portion and hidden ingredients are estimates.', max_length=1000)
    source: str = Field(default='AI estimate', max_length=300)
    fdc_id: int | None = None

class Analysis(Model):
    items: list[Food] = Field(max_length=30)
    warnings: list[str] = Field(max_length=20)

class Meal(Model):
    title: str = Field(min_length=1, max_length=200)
    day: date
    category: Literal['breakfast','lunch','dinner','snack'] = 'lunch'
    items: list[Food] = Field(min_length=1, max_length=30)

class Goals(Model):
    calories: float = Field(default=2900, gt=0, le=10000)
    protein: float = Field(default=160, ge=0, le=1000)
    carbs: float = Field(default=385, ge=0, le=1500)
    fat: float = Field(default=80, ge=0, le=1000)
    goal_weight: float = Field(default=175, gt=0, le=1500)
    objective: str = Field(default='Lean bulk', max_length=100)

class Weight(Model):
    day: date
    pounds: float = Field(gt=0, le=1500)

class Profile(Model):
    name: str = Field(max_length=100)
    age: int = Field(ge=18, le=120)
    height_cm: float = Field(gt=0, le=300)
    activity: float = Field(ge=1.2, le=2.4)
    current_weight: float = Field(gt=0, le=1500)
    goal_weight: float = Field(gt=0, le=1500)
    objective: str = Field(max_length=100)
    weekly_change: float = Field(ge=-2, le=2)
    sex: Literal['female','male']

def totals(meals):
    result = dict.fromkeys(['calories','protein','carbs','fat'], 0.0)
    for meal in meals:
        for item in meal['items']:
            for key in result:
                result[key] += item[key]
    return {key: round(value, 1) for key, value in result.items()}
