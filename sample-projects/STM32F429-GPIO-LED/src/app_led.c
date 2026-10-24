#include "app_led.h"
#include "stm32f4xx_hal.h"

#include <stdint.h>

#define LED_GREEN_PIN             GPIO_PIN_13
#define LED_RED_PIN               GPIO_PIN_14
#define BUTTON_PIN                GPIO_PIN_0
#define BUTTON_DEBOUNCE_MS        (40u)
#define NORMAL_HALF_PERIOD_MS     (500u)
#define FAST_HALF_PERIOD_MS       (125u)

static uint32_t last_toggle_ms;
static uint32_t last_button_change_ms;
static bool green_on;
static bool fast_mode;
static bool last_button_raw;
static bool stable_button_pressed;

static void update_led_outputs(void)
{
    HAL_GPIO_WritePin(GPIOG, LED_GREEN_PIN,
                      green_on ? GPIO_PIN_SET : GPIO_PIN_RESET);
    HAL_GPIO_WritePin(GPIOG, LED_RED_PIN,
                      green_on ? GPIO_PIN_RESET : GPIO_PIN_SET);
}

void AppLed_Init(void)
{
    GPIO_InitTypeDef io = {0};

    __HAL_RCC_GPIOG_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    /* On-board LED anodes are driven by GPIOG (active high). */
    HAL_GPIO_WritePin(GPIOG, LED_GREEN_PIN | LED_RED_PIN, GPIO_PIN_RESET);
    io.Pin = LED_GREEN_PIN | LED_RED_PIN;
    io.Mode = GPIO_MODE_OUTPUT_PP;
    io.Pull = GPIO_NOPULL;
    io.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOG, &io);

    /* The discovery board provides its own external pull-down for B1 / PA0. */
    io.Pin = BUTTON_PIN;
    io.Mode = GPIO_MODE_INPUT;
    io.Pull = GPIO_NOPULL;
    HAL_GPIO_Init(GPIOA, &io);

    green_on = true;
    fast_mode = false;
    last_button_raw = (HAL_GPIO_ReadPin(GPIOA, BUTTON_PIN) == GPIO_PIN_SET);
    stable_button_pressed = last_button_raw;
    last_button_change_ms = HAL_GetTick();
    last_toggle_ms = HAL_GetTick();
    update_led_outputs();
}

void AppLed_Process(void)
{
    const uint32_t now = HAL_GetTick();
    const bool raw_pressed = (HAL_GPIO_ReadPin(GPIOA, BUTTON_PIN) == GPIO_PIN_SET);

    if (raw_pressed != last_button_raw) {
        last_button_raw = raw_pressed;
        last_button_change_ms = now;
    }

    /* Unsigned subtraction safely handles the 32-bit HAL tick rollover. */
    if ((uint32_t)(now - last_button_change_ms) >= BUTTON_DEBOUNCE_MS &&
        raw_pressed != stable_button_pressed) {
        stable_button_pressed = raw_pressed;
        if (stable_button_pressed) {
            fast_mode = !fast_mode;        /* Only one toggle per press. */
            last_toggle_ms = now;          /* Restart interval after switching. */
        }
    }

    const uint32_t interval_ms = fast_mode ? FAST_HALF_PERIOD_MS : NORMAL_HALF_PERIOD_MS;
    if ((uint32_t)(now - last_toggle_ms) >= interval_ms) {
        last_toggle_ms = now;
        green_on = !green_on;
        update_led_outputs();
    }
}

bool AppLed_IsFastMode(void)
{
    return fast_mode;
}
