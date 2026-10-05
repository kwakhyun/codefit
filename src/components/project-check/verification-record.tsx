"use client";
import { useId } from "react";
import {
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from "@/components/ui/primitives";
import {
  emptyVerification,
  verificationStages,
  verificationStatus,
  type VerificationRecord as Record,
} from "@/lib/project-check/verification";

export function VerificationRecord({
  value,
  disabled,
  onChange,
}: {
  value?: Record;
  disabled: boolean;
  onChange: (record: Record) => void;
}) {
  const id = useId();
  const record = value ?? emptyVerification();
  const status = verificationStatus(value);
  return (
    <Disclosure className="verification-record">
      <DisclosureSummary>수정 전후 테스트 기록 — {status.label}</DisclosureSummary>
      <p>
        같은 테스트로 수정이 해당 결함을 해결했는지 확인하세요. 작업 중인 원본을 되돌리지 말고 별도
        사본을 사용하세요. 이 화면에서는 명령을 실행하지 않습니다.
      </p>
      <FieldLabel htmlFor={`${id}-command`}>같은 테스트의 실행 방법</FieldLabel>
      <Input
        id={`${id}-command`}
        value={record.command}
        disabled={disabled}
        maxLength={300}
        placeholder="테스트 이름, 실행 명령, 동일하게 유지할 조건"
        onChange={(event) => onChange({ ...record, command: event.target.value })}
      />
      <div className="verification-record-stages">
        {verificationStages.map(({ key, label, expected }) => (
          <fieldset key={key}>
            <legend>{label}</legend>
            <p>{expected}</p>
            <FieldLabel htmlFor={`${id}-${key}-outcome`}>{label} 결과</FieldLabel>
            <NativeSelect
              id={`${id}-${key}-outcome`}
              value={record[key].outcome}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...record,
                  [key]: {
                    ...record[key],
                    outcome: event.target.value as Record[typeof key]["outcome"],
                  },
                })
              }
            >
              <option value="not_run">미실행 / 확인 못함</option>
              <option value="failed">실패</option>
              <option value="passed">통과</option>
            </NativeSelect>
            <FieldLabel htmlFor={`${id}-${key}-evidence`}>{label} 실행 근거</FieldLabel>
            <Textarea
              id={`${id}-${key}-evidence`}
              rows={3}
              value={record[key].evidence}
              disabled={disabled}
              maxLength={600}
              placeholder="대상 커밋, 실제 출력과 실패 이유. 환경 오류라면 결함 재현과 구분하세요."
              onChange={(event) =>
                onChange({ ...record, [key]: { ...record[key], evidence: event.target.value } })
              }
            />
          </fieldset>
        ))}
      </div>
      <p role="status">
        {status.label}: {status.detail}
      </p>
      <p className="project-help">
        아래 ‘확인 기록 저장’을 눌러 보관하세요. 입력한 명령은 실행되지 않습니다.
      </p>
    </Disclosure>
  );
}
