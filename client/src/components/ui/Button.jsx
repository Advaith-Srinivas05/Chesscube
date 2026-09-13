import Spinner from './Spinner.jsx';
import styles from './Button.module.css';

// `as` renders another element or component, e.g. <Button as={Link} to="/play">.
export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type,
  children,
  ...props
}) {
  const isButton = Component === 'button';
  const inactive = disabled || loading;
  const classes = [styles.button, styles[variant], styles[size], loading && styles.loading, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component
      className={classes}
      {...(isButton ? { type: type ?? 'button', disabled: inactive } : { 'aria-disabled': inactive || undefined })}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="1em" label={null} className={styles.spinner} />}
      {children}
    </Component>
  );
}
