#ifndef STM32F4XX_HAL_MOCK_H
#define STM32F4XX_HAL_MOCK_H

#include <stdint.h>

typedef struct { unsigned identifier; } GPIO_TypeDef;
extern GPIO_TypeDef fake_port_a;
extern GPIO_TypeDef fake_port_g;
#define GPIOA (&fake_port_a)
#define GPIOG (&fake_port_g)

#define GPIO_PIN_0 ((uint16_t)(1u << 0))
#define GPIO_PIN_13 ((uint16_t)(1u << 13))
#define GPIO_PIN_14 ((uint16_t)(1u << 14))
#define GPIO_MODE_OUTPUT_PP 1u
#define GPIO_MODE_INPUT 2u
#define GPIO_NOPULL 0u
#define GPIO_SPEED_FREQ_LOW 0u

typedef enum { GPIO_PIN_RESET = 0, GPIO_PIN_SET = 1 } GPIO_PinState;
typedef struct { uint32_t Pin, Mode, Pull, Speed, Alternate; } GPIO_InitTypeDef;

#define __HAL_RCC_GPIOG_CLK_ENABLE() ((void)0)
#define __HAL_RCC_GPIOA_CLK_ENABLE() ((void)0)
uint32_t HAL_GetTick(void);
void HAL_GPIO_Init(GPIO_TypeDef *gpio, GPIO_InitTypeDef *cfg);
void HAL_GPIO_WritePin(GPIO_TypeDef *gpio, uint16_t pin, GPIO_PinState state);
GPIO_PinState HAL_GPIO_ReadPin(GPIO_TypeDef *gpio, uint16_t pin);
#endif
