"""Benchmark HTTP minimal pour qualifier l'endpoint vLLM.

Ce script mesure uniquement l'inférence et le tool-calling. Il ne remplace pas
un test de charge complet Twilio, STT et TTS.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass


@dataclass(frozen=True)
class RequestResult:
    latency_ms: float
    http_ok: bool
    tool_call_ok: bool
    error: str | None = None


def percentile(values: list[float], ratio: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(round((len(ordered) - 1) * ratio), len(ordered) - 1)
    return ordered[index]


def build_payload(model: str) -> bytes:
    return json.dumps(
        {
            "model": model,
            "temperature": 0,
            "max_tokens": 128,
            "messages": [
                {
                    "role": "system",
                    "content": "Utilise l'outil pour enregistrer la commande confirmée.",
                },
                {
                    "role": "user",
                    "content": (
                        "Commande confirmée pour Marie, aujourd'hui à 19:30, "
                        "un menu burger, téléphone 06 12 34 56 78."
                    ),
                },
            ],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "create_appointment",
                        "description": "Créer une commande confirmée.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "telephone": {"type": "string"},
                                "time": {"type": "string"},
                            },
                            "required": ["name", "telephone", "time"],
                        },
                    },
                }
            ],
            "tool_choice": "auto",
        }
    ).encode("utf-8")


def run_request(base_url: str, api_key: str, payload: bytes, timeout: float) -> RequestResult:
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read())
        latency_ms = (time.perf_counter() - started) * 1000
        message = (data.get("choices") or [{}])[0].get("message") or {}
        tool_calls = message.get("tool_calls") or []
        valid_tool = any(
            (item.get("function") or {}).get("name") == "create_appointment"
            for item in tool_calls
            if isinstance(item, dict)
        )
        return RequestResult(latency_ms, True, valid_tool)
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        return RequestResult(latency_ms, False, False, type(exc).__name__)


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark de l'endpoint vLLM MySmartFood")
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--timeout", type=float, default=30)
    args = parser.parse_args()

    base_url = os.environ.get("VLLM_BASE_URL", "").strip()
    api_key = os.environ.get("VLLM_API_KEY", "").strip()
    model = os.environ.get("VLLM_MODEL", "").strip()
    if not base_url or not api_key or not model:
        parser.error("VLLM_BASE_URL, VLLM_API_KEY et VLLM_MODEL sont requis")

    payload = build_payload(model)
    results: list[RequestResult] = []
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=max(args.concurrency, 1)) as executor:
        futures = [
            executor.submit(run_request, base_url, api_key, payload, args.timeout)
            for _ in range(max(args.requests, 1))
        ]
        for future in as_completed(futures):
            results.append(future.result())

    elapsed = time.perf_counter() - started
    successful = [result for result in results if result.http_ok]
    latencies = [result.latency_ms for result in successful]
    valid_tools = sum(result.tool_call_ok for result in successful)
    errors = sorted({result.error for result in results if result.error})

    print(f"requests={len(results)} concurrency={args.concurrency} elapsed_s={elapsed:.2f}")
    print(f"http_success={len(successful)}/{len(results)} throughput_rps={len(results) / elapsed:.2f}")
    print(
        "latency_ms "
        f"mean={statistics.fmean(latencies) if latencies else 0:.0f} "
        f"p50={percentile(latencies, 0.50):.0f} "
        f"p95={percentile(latencies, 0.95):.0f}"
    )
    print(f"valid_tool_calls={valid_tools}/{len(successful)} errors={','.join(errors) or 'none'}")

    return 0 if len(successful) == len(results) and valid_tools == len(successful) else 1


if __name__ == "__main__":
    raise SystemExit(main())
