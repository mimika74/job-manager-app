<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreJobRequest;
use App\Http\Requests\UpdateJobRequest;
use App\Models\Job;
use Illuminate\Http\JsonResponse;

class JobController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Job::latest()->get());
    }

    public function store(StoreJobRequest $request): JsonResponse
    {
        $job = Job::create($request->validated());

        return response()->json($job, 201);
    }

    public function show(Job $job): JsonResponse
    {
        return response()->json($job);
    }

    public function update(UpdateJobRequest $request, Job $job): JsonResponse
    {
        $job->update($request->validated());

        return response()->json($job);
    }

    public function destroy(Job $job): JsonResponse
    {
        $job->delete();

        return response()->json(null, 204);
    }
}
