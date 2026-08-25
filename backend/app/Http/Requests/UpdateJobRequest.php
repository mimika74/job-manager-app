<?php

namespace App\Http\Requests;

use App\Models\Job;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateJobRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'company_name' => ['sometimes', 'required', 'string', 'max:255'],
            'position' => ['sometimes', 'required', 'string', 'max:255'],
            'status' => ['sometimes', 'required', Rule::in(Job::STATUSES)],
            'application_date' => ['nullable', 'date'],
            'url' => ['nullable', 'url', 'max:2048'],
            'location' => ['nullable', 'string', 'max:255'],
            'salary_min' => ['nullable', 'integer', 'min:0'],
            'salary_max' => ['nullable', 'integer', 'min:0'],
            'memo' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            /** @var Job $job */
            $job = $this->route('job');

            $salaryMin = $this->input('salary_min', $job->salary_min);
            $salaryMax = $this->input('salary_max', $job->salary_max);

            if (! is_null($salaryMin) && ! is_null($salaryMax) && $salaryMax < $salaryMin) {
                $validator->errors()->add('salary_max', '年収レンジ(上限)は年収レンジ(下限)以上の値にしてください。');
            }
        });
    }
}
