# Python Feedback

## Basic feedback (on-chain tx)

```python
tx = sdk.giveFeedback(
    agentId="11155111:123",
    value=85,
    tag1="data_analyst",
    tag2="finance",
    endpoint="https://example.com/endpoint",
)
feedback = tx.wait_confirmed(timeout=180).result
```

## Rich feedback with off-chain file

```python
feedback_file = sdk.prepareFeedbackFile({
    "capability": "tools",
    "name": "code_generation",
    "skill": "python",
    "text": "Great agent!",
})

tx = sdk.giveFeedback(
    agentId="11155111:123",
    value=85,
    tag1="data_analyst",
    tag2="finance",
    feedbackFile=feedback_file,
)
feedback = tx.wait_confirmed(timeout=180).result
```

## Search feedback

```python
results = sdk.searchFeedback(
    agentId="11155111:123",
    capabilities=["tools"],
    minValue=80, maxValue=100
)
```

## Reputation summary

```python
summary = sdk.getReputationSummary("11155111:123")
```

> Version-sensitive: `giveFeedback`, `prepareFeedbackFile`, `searchFeedback`, `getReputationSummary`, `wait_confirmed` reflect v1.5.3.
