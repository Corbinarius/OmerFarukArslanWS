#ifndef APP_LED_H
#define APP_LED_H

#include <stdbool.h>

/* Configure onboard PG13/PG14 LEDs and PA0 user button. */
void AppLed_Init(void);

/* Call continuously from main(); non-blocking software state machine. */
void AppLed_Process(void);

/* false: 500 ms per state, true: 125 ms per state. */
bool AppLed_IsFastMode(void);

#endif /* APP_LED_H */
