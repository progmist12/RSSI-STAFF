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

  const scrollFocusedInputIntoView = useCallback(() => {
    const target = focusedInputRef.current;
    if (target == null) return;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        target,
        100,
        true,
      );
    });
  }, [scrollRef]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisibleRef.current = true;
      scrollFocusedInputIntoView();
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollFocusedInputIntoView]);

  const value: KeyboardInputScrollContextValue = {
    onInputFocus: target => {
      focusedInputRef.current = target;
      if (keyboardVisibleRef.current) scrollFocusedInputIntoView();
    },
    onInputBlur: target => {
      if (focusedInputRef.current === target) focusedInputRef.current = null;
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
