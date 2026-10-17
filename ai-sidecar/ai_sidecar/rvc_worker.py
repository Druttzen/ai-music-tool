"""File bridge executed by the isolated RVC interpreter, never the shared engine."""
import argparse
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--index", default="")
    parser.add_argument("--pitch", type=int, default=0)
    args = parser.parse_args()
    sys.argv = [sys.argv[0]]  # RVC's Config parses process arguments itself.
    from rvc_python.infer import RVCInference
    engine = RVCInference(device="cpu")
    engine.load_model(args.model, index_path=args.index)
    engine.set_params(f0up_key=args.pitch)
    engine.infer_file(args.input, args.output)


if __name__ == "__main__":
    main()
