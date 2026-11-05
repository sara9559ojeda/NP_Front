import { useId } from 'react';
import { formatDateTime, t, tDynamic } from '../../i18n';

export const MIN_GRADE = 1;
export const MAX_GRADE = 5;

interface PhobiaGradePickerProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** When the patient last saved a grade (v1.1.0 `phobiaGradeUpdatedAt`). */
  updatedAt: string | null;
}

function gradeText(value: number): string {
  return t('therapy.grade.value', { n: value, max: MAX_GRADE, name: tDynamic(`phobiaGrade.${value}`, 'common.noData') });
}

/** Self-reported phobia grade for today, 1 to 5 (BPMN "Ajustar grado de fobia"). */
export function PhobiaGradePicker({ value, onChange, disabled = false, updatedAt }: PhobiaGradePickerProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="grade-picker">
      <label htmlFor={id} className="field__label">
        {t('therapy.grade.label')}
      </label>
      <output htmlFor={id} className="grade-picker__output">
        {gradeText(value)}
      </output>
      <input
        id={id}
        type="range"
        className="grade-picker__range"
        min={MIN_GRADE}
        max={MAX_GRADE}
        step={1}
        value={value}
        disabled={disabled}
        aria-valuetext={gradeText(value)}
        aria-describedby={hintId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="grade-picker__scale" aria-hidden="true">
        <span>{tDynamic(`phobiaGrade.${MIN_GRADE}`, 'common.noData')}</span>
        <span>{tDynamic(`phobiaGrade.${MAX_GRADE}`, 'common.noData')}</span>
      </div>
      <p id={hintId} className="field__hint">
        {updatedAt ? t('therapy.grade.updated', { date: formatDateTime(updatedAt) }) : t('therapy.grade.never')}
      </p>
    </div>
  );
}
