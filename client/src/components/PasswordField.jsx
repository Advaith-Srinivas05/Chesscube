import { useState } from 'react';
import Button from './ui/Button.jsx';
import Field from './ui/Field.jsx';

export default function PasswordField({ label = 'Password', hint, error, className, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      className={className}
      adornment={
        <Button variant="ghost" size="sm" aria-pressed={visible} onClick={() => setVisible((value) => !value)}>
          {visible ? 'Hide' : 'Show'}
        </Button>
      }
    >
      <input type={visible ? 'text' : 'password'} spellCheck={false} {...inputProps} />
    </Field>
  );
}
