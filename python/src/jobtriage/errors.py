"""Project-rooted exception hierarchy for jobtriage."""


class JobtriageError(Exception):
    pass


class JobTechAPIError(JobtriageError):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(f'JobTech API returned {status_code}: {message}')
        self.status_code = status_code
        self.message = message


class IngestionError(JobtriageError):
    pass
