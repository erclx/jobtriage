"""Run the jobtriage API with uvicorn."""

import os

import uvicorn


def run() -> None:
    host = os.environ.get('JOBTRIAGE_API_HOST', '127.0.0.1')
    port = int(os.environ.get('JOBTRIAGE_API_PORT') or os.environ.get('PORT') or '8000')
    reload_flag = os.environ.get('JOBTRIAGE_API_RELOAD', '0') == '1'

    uvicorn.run(
        'jobtriage.api.app:app_factory',
        host=host,
        port=port,
        reload=reload_flag,
        factory=True,
    )


if __name__ == '__main__':
    run()
