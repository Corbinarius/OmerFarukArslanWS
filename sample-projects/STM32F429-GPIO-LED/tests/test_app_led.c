#include "app_led.h"
#include "stm32f4xx_hal.h"

#include <assert.h>
#include <stdbool.h>
#include <stdio.h>

GPIO_TypeDef fake_port_a = {1};
GPIO_TypeDef fake_port_g = {7};
static uint32_t fake_tick;
static bool button_pressed;
static bool green_led;
static bool red_led;

uint32_t HAL_GetTick(void) { return fake_tick; }
void HAL_GPIO_Init(GPIO_TypeDef *gpio, GPIO_InitTypeDef *cfg)
{
    assert(gpio == GPIOA || gpio == GPIOG);
    if (gpio == GPIOG) assert(cfg->Mode == GPIO_MODE_OUTPUT_PP);
    if (gpio == GPIOA) assert(cfg->Mode == GPIO_MODE_INPUT);
}
void HAL_GPIO_WritePin(GPIO_TypeDef *gpio, uint16_t pin, GPIO_PinState value)
{
    assert(gpio == GPIOG);
    if (pin & GPIO_PIN_13) green_led = (value == GPIO_PIN_SET);
    if (pin & GPIO_PIN_14) red_led = (value == GPIO_PIN_SET);
}
GPIO_PinState HAL_GPIO_ReadPin(GPIO_TypeDef *gpio, uint16_t pin)
{
    assert(gpio == GPIOA && pin == GPIO_PIN_0);
    return button_pressed ? GPIO_PIN_SET : GPIO_PIN_RESET;
}
static void step(uint32_t time_ms, bool pressed)
{
    fake_tick = time_ms;
    button_pressed = pressed;
    AppLed_Process();
}
int main(void)
{
    AppLed_Init();
    assert(green_led && !red_led && !AppLed_IsFastMode());
    step(499, false); assert(green_led && !red_led);
    step(500, false); assert(!green_led && red_led);

    /* Mechanical bounce less than 40 ms does not change modes. */
    step(510, true); step(520, false);
    step(550, false); assert(!AppLed_IsFastMode());

    /* One stable rising edge enters fast mode. */
    step(600, true); step(639, true); assert(!AppLed_IsFastMode());
    step(640, true); assert(AppLed_IsFastMode());
    step(764, true); assert(!green_led && red_led);
    step(765, true); assert(green_led && !red_led);
    step(1000, true); assert(AppLed_IsFastMode()); /* Holding does not toggle. */

    /* Release, debounce, second press => normal mode. */
    step(1020, false); step(1060, false);
    step(1080, true); step(1120, true); assert(!AppLed_IsFastMode());
    printf("PASS: 500/125 ms mode, button debounce, one toggle per press\n");
    return 0;
}
