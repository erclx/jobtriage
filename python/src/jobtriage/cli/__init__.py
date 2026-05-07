"""Typer entry for the jobtriage CLI."""

import typer

from jobtriage.cli.evaluate import evaluate_command
from jobtriage.cli.index import index_command
from jobtriage.cli.mark_status import mark_status_command
from jobtriage.cli.search import search_command
from jobtriage.cli.sweep import sweep_command

app = typer.Typer(
    name='jobtriage',
    no_args_is_help=True,
    add_completion=False,
    help='Sweep Platsbanken into local SQLite, embed, search, and evaluate.',
)

app.command('sweep')(sweep_command)
app.command('mark-status')(mark_status_command)
app.command('index')(index_command)
app.command('search')(search_command)
app.command('evaluate')(evaluate_command)
