FROM python:3.12-slim

WORKDIR /app

COPY requirements-deploy.txt ./
RUN pip install --no-cache-dir -r requirements-deploy.txt

COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir --no-deps .

RUN groupadd --system app && useradd --system --gid app app && chown -R app:app /app
USER app

ENV JOBTRIAGE_API_HOST=0.0.0.0 \
    JOBTRIAGE_DEPLOY_MODE=slim \
    PYTHONUNBUFFERED=1

EXPOSE 8080
CMD ["python", "-m", "jobtriage.api"]
