import { AVATARS } from '../../shared/avatars.js';
import Avatar from '../Avatar.jsx';
import styles from './AvatarPicker.module.css';

const label = (id) => id.replace('-', ' on ');

export default function AvatarPicker({ value, onChange, labelledBy }) {
  return (
    <div
      className={styles.grid}
      role="radiogroup"
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': 'Profile picture' })}
    >
      {AVATARS.map(({ id }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={label(id)}
          className={`${styles.option} ${value === id ? styles.selected : ''}`}
          onClick={() => onChange(id)}
        >
          <Avatar id={id} size={52} />
        </button>
      ))}
    </div>
  );
}
