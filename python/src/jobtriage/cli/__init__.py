"""Typer entry for the jobtriage CLI."""

import typer

from jobtriage.cli.mark_status import mark_status_command
from jobtriage.cli.sweep import sweep_command

app = typer.Typer(
    name='jobtriage',
    no_args_is_help=True,
    add_completion=False,
    help='Sweep Platsbanken into local SQLite and record engagement state.',
)

app.command('sweep')(sweep_command)
app.command('mark-status')(mark_status_command)
