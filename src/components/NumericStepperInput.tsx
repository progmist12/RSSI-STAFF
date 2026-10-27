import React from 'react';
import {
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
} from 'react-native';

type NumericStepperInputProps = Pick<
  TextInputProps,
  'editable' | 'keyboardType' | 'placeholder' | 'placeholderTextColor'
> & {
  accessibilityLabel: string;
  value: string;
  onChangeText: (value: string) => void;
  step: number;
  integer?: boolean;
  textColor: string;
  borderColor: string;
  backgroundColor: string;
  style?: StyleProp<TextStyle>;
};

export function NumericStepperInput({
  accessibilityLabel,
  value,
  onChangeText,
  step,
  integer = false,
  editable = true,
  textColor,
  borderColor,
  backgroundColor,
  style,
  ...inputProps
}: NumericStepperInputProps) {
  const changeBy = (direction: -1 | 1) => {
    const current = Number(value);
    const next = Math.max(0, (Number.isFinite(current) ? current : 0) + direction * step);
    const formatted = integer
      ? String(Math.round(next))
      : String(Number(next.toFixed(2)));
    onChangeText(formatted);
  };

  const current = Number(value);
  const canDecrease = value.trim() !== '' && Number.isFinite(current) && current > 0;

  return (
    <View style={{ position: 'relative' }}>
      <TextInput
        {...inputProps}
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={accessibilityLabel}
        style={[style, { paddingRight: 42 }]}
      />
      <View
        style={{
          position: 'absolute',
          top: 1,
          right: 1,
          bottom: 1,
          width: 30,
          borderLeftWidth: 1,
          borderColor,
          borderTopRightRadius: 11,
          borderBottomRightRadius: 11,
          backgroundColor,
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${accessibilityLabel}`}
          disabled={!editable}
          onPress={() => changeBy(1)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={3}
        >
          <Text style={{ color: textColor, fontSize: 8, lineHeight: 10 }}>▲</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${accessibilityLabel}`}
          disabled={!editable || !canDecrease}
          onPress={() => changeBy(-1)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={3}
        >
          <Text
            style={{
              color: textColor,
              fontSize: 8,
              lineHeight: 10,
              opacity: editable && canDecrease ? 1 : 0.4,
            }}
          >
            ▼
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
