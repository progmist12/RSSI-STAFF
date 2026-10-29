import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { Keyboard, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import type { ScrollViewInstance } from 'react-native';

type ScrollRef = React.RefObject<ScrollViewInstance | null>;

type KeyboardInputScrollContextValue = {
  onInputFocus: (target: number) => void;
  onInputBlur: (target: number) => void;
};

const KeyboardInputScrollContext =
  createContext<KeyboardInputScrollContextValue | null>(null);

export function KeyboardInputScrollProvider({
  scrollRef,
  children,
}: {
  scrollRef: ScrollRef;
  children: React.ReactNode;
}) {
  const focusedInputRef = useRef<number | null>(null);
  const keyboardVisibleRef = useRef(false);
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearScrollTimers = useCallback(() => {
    scrollTimersRef.current.forEach(clearTimeout);
    scrollTimersRef.current = [];
  }, []);

  const scrollFocusedInputIntoView = useCallback(() => {
    clearScrollTimers();
    const delays = keyboardVisibleRef.current ? [0, 100, 260] : [80, 240, 460];

    scrollTimersRef.current = delays.map(delay =>
      setTimeout(() => {
        requestAnimationFrame(() => {
          const target = focusedInputRef.current;
          if (target == null) return;
          try {
            scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
              target,
              120,
              true,
            );
          } catch {
            // A focus can race with a screen transition; the next retry will
            // scroll the currently focused field after layout settles.
          }
        });
      }, delay),
    );
  }, [clearScrollTimers, scrollRef]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisibleRef.current = true;
      scrollFocusedInputIntoView();
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false;
      clearScrollTimers();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      clearScrollTimers();
    };
  }, [clearScrollTimers, scrollFocusedInputIntoView]);

  const value: KeyboardInputScrollContextValue = {
    onInputFocus: target => {
      focusedInputRef.current = target;
      scrollFocusedInputIntoView();
    },
    onInputBlur: target => {
      if (focusedInputRef.current === target) {
        focusedInputRef.current = null;
        clearScrollTimers();
      }
    },
  };

  return (
    <KeyboardInputScrollContext.Provider value={value}>
      {children}
    </KeyboardInputScrollContext.Provider>
  );
}

/** Text input that asks its nearest registered scroll view to reveal it. */
export function KeyboardAwareTextInput(props: TextInputProps) {
  const scrollRef = useContext(KeyboardInputScrollContext);
  const { onFocus, onBlur, ...inputProps } = props;

  const handleFocus: NonNullable<TextInputProps['onFocus']> = event => {
    onFocus?.(event);
    const target = event.nativeEvent.target;
    if (target != null) scrollRef?.onInputFocus(target);
  };

  const handleBlur: NonNullable<TextInputProps['onBlur']> = event => {
    onBlur?.(event);
    const target = event.nativeEvent.target;
    if (target != null) scrollRef?.onInputBlur(target);
  };

  return (
    <TextInput {...inputProps} onFocus={handleFocus} onBlur={handleBlur} />
  );
}
